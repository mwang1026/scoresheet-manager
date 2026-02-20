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
async def test_list_teams(client, db_session, sample_team_data):
    """Test listing teams."""
    # Add teams
    team1 = Team(**sample_team_data)
    team2 = Team(name="Another Team", scoresheet_id=2, is_my_team=True)
    team3 = Team(name="Third Team", scoresheet_id=3, is_my_team=False)

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
        assert "name" in team
        assert "scoresheet_id" in team
        assert "is_my_team" in team


@pytest.mark.asyncio
async def test_list_teams_ordering(client, db_session):
    """Test that teams are ordered by scoresheet_id."""
    # Add teams in reversed order
    team3 = Team(name="Team Three", scoresheet_id=3, is_my_team=False)
    team1 = Team(name="Team One", scoresheet_id=1, is_my_team=False)
    team2 = Team(name="Team Two", scoresheet_id=2, is_my_team=False)

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
async def test_list_teams_includes_my_team_flag(client, db_session):
    """Test that is_my_team flag is correctly returned."""
    team1 = Team(name="Other Team", scoresheet_id=1, is_my_team=False)
    team2 = Team(name="My Team", scoresheet_id=2, is_my_team=True)

    db_session.add_all([team1, team2])
    await db_session.commit()

    # Query API
    response = await client.get("/api/teams")
    assert response.status_code == 200

    data = response.json()

    # Find teams in response
    team1_data = next(t for t in data["teams"] if t["scoresheet_id"] == 1)
    team2_data = next(t for t in data["teams"] if t["scoresheet_id"] == 2)

    assert team1_data["is_my_team"] is False
    assert team2_data["is_my_team"] is True
