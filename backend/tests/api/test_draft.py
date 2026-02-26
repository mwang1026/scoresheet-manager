"""
Tests for draft schedule API endpoints.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models import DraftSchedule, League, Team


@pytest.mark.asyncio
async def test_get_draft_schedule_returns_picks(client, db_session, setup_team_context):
    """GET /api/draft/schedule returns ordered picks."""
    ctx = setup_team_context
    league = ctx["league"]
    team = ctx["team"]

    # Create a second team for from_team reference
    team2 = Team(league_id=league.id, name="Other Team", scoresheet_id=2)
    db_session.add(team2)
    await db_session.flush()

    # Create draft schedule rows
    ds1 = DraftSchedule(
        league_id=league.id,
        round=14,
        pick_in_round=1,
        team_id=team.id,
        from_team_id=None,
        scheduled_at=datetime(2026, 3, 15, 12, 0, 0, tzinfo=timezone.utc),
    )
    ds2 = DraftSchedule(
        league_id=league.id,
        round=14,
        pick_in_round=2,
        team_id=team2.id,
        from_team_id=team.id,  # Traded pick
        scheduled_at=datetime(2026, 3, 15, 12, 30, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([ds1, ds2])
    await db_session.commit()

    response = await client.get(
        "/api/draft/schedule",
        headers={"X-Team-Id": str(team.id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["league_id"] == league.id
    assert data["draft_complete"] is False
    assert len(data["picks"]) == 2

    # Ordered by scheduled_time
    assert data["picks"][0]["round"] == 14
    assert data["picks"][0]["pick_in_round"] == 1
    assert data["picks"][0]["team_name"] == "Test Team"
    assert data["picks"][0]["from_team_name"] is None

    assert data["picks"][1]["pick_in_round"] == 2
    assert data["picks"][1]["team_name"] == "Other Team"
    assert data["picks"][1]["from_team_name"] == "Test Team"


@pytest.mark.asyncio
async def test_get_draft_schedule_no_league_returns_404(client, db_session):
    """GET /api/draft/schedule without league context returns 404."""
    response = await client.get("/api/draft/schedule")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_draft_schedule_empty(client, db_session, setup_team_context):
    """GET /api/draft/schedule returns empty list when no schedule rows."""
    ctx = setup_team_context
    team = ctx["team"]

    response = await client.get(
        "/api/draft/schedule",
        headers={"X-Team-Id": str(team.id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["picks"] == []
    assert data["draft_complete"] is False


@pytest.mark.asyncio
async def test_post_refresh_no_league_returns_404(client, db_session):
    """POST /api/draft/refresh without league context returns 404."""
    response = await client.post("/api/draft/refresh")
    assert response.status_code == 404
