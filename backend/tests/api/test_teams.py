"""Tests for /api/teams endpoints."""

import pytest

from app.models import Team


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
