"""Tests for /api/teams and /api/me/teams endpoints."""

import pytest

from app.models import League, Team, User, UserTeam


@pytest.mark.asyncio
async def test_list_teams_empty(client):
    """Test listing teams when database is empty."""
    response = await client.get("/api/teams")
    assert response.status_code == 200

    data = response.json()
    assert data["teams"] == []


@pytest.mark.asyncio
async def test_list_teams(client, db_session, sample_league):
    """Test listing teams."""
    # Add teams
    team1 = Team(league_id=sample_league.id, name="Test Team", scoresheet_id=1)
    team2 = Team(league_id=sample_league.id, name="Another Team", scoresheet_id=2)
    team3 = Team(league_id=sample_league.id, name="Third Team", scoresheet_id=3)

    db_session.add_all([team1, team2, team3])
    await db_session.commit()

    # Query API
    response = await client.get("/api/teams")
    assert response.status_code == 200

    data = response.json()
    assert len(data["teams"]) == 3

    # Verify all fields are present
    for team in data["teams"]:
        assert "id" in team
        assert "league_id" in team
        assert "league_name" in team
        assert "name" in team
        assert "scoresheet_id" in team
        assert "is_my_team" in team  # Computed field for backward compat


@pytest.mark.asyncio
async def test_list_teams_ordering(client, db_session, sample_league):
    """Test that teams are ordered by scoresheet_id."""
    # Add teams in reversed order
    team3 = Team(league_id=sample_league.id, name="Team Three", scoresheet_id=3)
    team1 = Team(league_id=sample_league.id, name="Team One", scoresheet_id=1)
    team2 = Team(league_id=sample_league.id, name="Team Two", scoresheet_id=2)

    db_session.add_all([team3, team1, team2])
    await db_session.commit()

    # Query API
    response = await client.get("/api/teams")
    assert response.status_code == 200

    data = response.json()
    assert len(data["teams"]) == 3

    # Verify ordering by scoresheet_id
    assert data["teams"][0]["scoresheet_id"] == 1
    assert data["teams"][0]["name"] == "Team One"
    assert data["teams"][1]["scoresheet_id"] == 2
    assert data["teams"][1]["name"] == "Team Two"
    assert data["teams"][2]["scoresheet_id"] == 3
    assert data["teams"][2]["name"] == "Team Three"


@pytest.mark.asyncio
async def test_list_teams_includes_league_name(client, db_session, sample_league):
    """Test that each team response includes the league's name."""
    team = Team(league_id=sample_league.id, name="Test Team", scoresheet_id=1)
    db_session.add(team)
    await db_session.commit()

    response = await client.get("/api/teams")
    assert response.status_code == 200

    data = response.json()
    assert len(data["teams"]) == 1
    assert data["teams"][0]["league_name"] == sample_league.name


@pytest.mark.asyncio
async def test_list_teams_includes_my_team_flag(client, db_session, sample_league):
    """Test that is_my_team flag is correctly computed based on DEFAULT_TEAM_ID."""
    # Create teams
    team1 = Team(league_id=sample_league.id, name="Other Team", scoresheet_id=1)
    team2 = Team(league_id=sample_league.id, name="My Team", scoresheet_id=2)

    db_session.add_all([team1, team2])
    await db_session.commit()
    await db_session.refresh(team1)
    await db_session.refresh(team2)

    # Query API without X-Team-Id header (uses DEFAULT_TEAM_ID=1)
    response = await client.get("/api/teams")
    assert response.status_code == 200

    data = response.json()

    # Find teams in response
    team1_data = next(t for t in data["teams"] if t["scoresheet_id"] == 1)
    team2_data = next(t for t in data["teams"] if t["scoresheet_id"] == 2)

    # Team 1 should be "my team" because its DB ID=1 matches DEFAULT_TEAM_ID
    assert team1_data["is_my_team"] is True
    assert team2_data["is_my_team"] is False


@pytest.mark.asyncio
async def test_list_teams_respects_x_team_id_header(client, db_session, sample_league):
    """Test that X-Team-Id header correctly sets is_my_team flag."""
    # Create 2 teams
    team1 = Team(league_id=sample_league.id, name="Team One", scoresheet_id=1)
    team2 = Team(league_id=sample_league.id, name="Team Two", scoresheet_id=2)

    db_session.add_all([team1, team2])
    await db_session.commit()
    await db_session.refresh(team1)
    await db_session.refresh(team2)

    # Send GET /api/teams with X-Team-Id set to team2's DB id
    response = await client.get("/api/teams", headers={"X-Team-Id": str(team2.id)})
    assert response.status_code == 200

    data = response.json()
    team1_data = next(t for t in data["teams"] if t["id"] == team1.id)
    team2_data = next(t for t in data["teams"] if t["id"] == team2.id)

    # team2 should now be "my team" because we sent X-Team-Id: team2.id
    assert team2_data["is_my_team"] is True
    assert team1_data["is_my_team"] is False


# --- /api/me/teams tests ---


@pytest.mark.asyncio
async def test_get_my_teams_no_user_teams(client, db_session, sample_league):
    """Test GET /api/me/teams when the team has no associated user."""
    team = Team(league_id=sample_league.id, name="Orphan Team", scoresheet_id=1)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    response = await client.get("/api/me/teams", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    assert data["teams"] == []


@pytest.mark.asyncio
async def test_get_my_teams_single_team(client, db_session, setup_team_context):
    """Test GET /api/me/teams returns team with full league info."""
    team = setup_team_context["team"]
    league = setup_team_context["league"]

    response = await client.get("/api/me/teams", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    assert len(data["teams"]) == 1

    t = data["teams"][0]
    assert t["id"] == team.id
    assert t["name"] == team.name
    assert t["scoresheet_id"] == team.scoresheet_id
    assert t["league_id"] == league.id
    assert t["league_name"] == league.name
    assert t["league_season"] == league.season
    assert t["role"] == "owner"


@pytest.mark.asyncio
async def test_get_my_teams_multiple_teams(client, db_session, sample_league):
    """Test GET /api/me/teams returns all teams for a user across leagues."""
    # Second league
    league2 = League(name="NL Gaylord Perry", season=2025)
    db_session.add(league2)
    await db_session.commit()
    await db_session.refresh(league2)

    # Two teams in different leagues
    team1 = Team(league_id=sample_league.id, name="Team Alpha", scoresheet_id=1)
    team2 = Team(league_id=league2.id, name="Team Beta", scoresheet_id=1)
    db_session.add_all([team1, team2])
    await db_session.commit()
    await db_session.refresh(team1)
    await db_session.refresh(team2)

    # User associated with both teams
    user = User(email="multi@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    ut1 = UserTeam(user_id=user.id, team_id=team1.id, role="owner")
    ut2 = UserTeam(user_id=user.id, team_id=team2.id, role="owner")
    db_session.add_all([ut1, ut2])
    await db_session.commit()

    response = await client.get("/api/me/teams", headers={"X-Team-Id": str(team1.id)})
    assert response.status_code == 200

    data = response.json()
    assert len(data["teams"]) == 2

    names = {t["name"] for t in data["teams"]}
    assert "Team Alpha" in names
    assert "Team Beta" in names

    # All items should have required fields
    for t in data["teams"]:
        assert "id" in t
        assert "league_name" in t
        assert "league_season" in t
        assert "role" in t


@pytest.mark.asyncio
async def test_get_my_teams_ordering(client, db_session):
    """Test GET /api/me/teams orders by league name then scoresheet_id."""
    league_z = League(name="Z League", season=2026)
    league_a = League(name="A League", season=2026)
    db_session.add_all([league_z, league_a])
    await db_session.commit()
    await db_session.refresh(league_z)
    await db_session.refresh(league_a)

    team_z = Team(league_id=league_z.id, name="Team Z", scoresheet_id=1)
    team_a = Team(league_id=league_a.id, name="Team A", scoresheet_id=1)
    db_session.add_all([team_z, team_a])
    await db_session.commit()
    await db_session.refresh(team_z)
    await db_session.refresh(team_a)

    user = User(email="order@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    ut_z = UserTeam(user_id=user.id, team_id=team_z.id, role="owner")
    ut_a = UserTeam(user_id=user.id, team_id=team_a.id, role="owner")
    db_session.add_all([ut_z, ut_a])
    await db_session.commit()

    response = await client.get("/api/me/teams", headers={"X-Team-Id": str(team_z.id)})
    assert response.status_code == 200

    data = response.json()
    assert len(data["teams"]) == 2
    # "A League" should sort before "Z League"
    assert data["teams"][0]["league_name"] == "A League"
    assert data["teams"][1]["league_name"] == "Z League"
