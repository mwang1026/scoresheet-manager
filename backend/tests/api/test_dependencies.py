"""Tests for API dependency functions — get_current_team ownership check."""

import pytest

from app.models import League, Team, User, UserTeam


@pytest.fixture
async def _ownership_setup(db_session, sample_league):
    """Create user + two teams; user owns only team1."""
    team1 = Team(league_id=sample_league.id, name="My Team", scoresheet_id=51)
    team2 = Team(league_id=sample_league.id, name="Other Team", scoresheet_id=52)
    db_session.add_all([team1, team2])
    await db_session.commit()
    await db_session.refresh(team1)
    await db_session.refresh(team2)

    user = User(email="owner@test.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # user owns team1 only
    db_session.add(UserTeam(user_id=user.id, team_id=team1.id, role="owner"))
    await db_session.commit()

    return {"user": user, "team1": team1, "team2": team2}


@pytest.mark.asyncio
async def test_ownership_check_allows_owned_team(client, monkeypatch, _ownership_setup):
    """In prod mode, user can access a team they own."""
    from app.config import settings

    monkeypatch.setattr(settings, "AUTH_SECRET", "test-secret")

    setup = _ownership_setup
    response = await client.get(
        "/api/draft-queue",
        headers={
            "X-User-Email": setup["user"].email,
            "X-Team-Id": str(setup["team1"].id),
        },
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_ownership_check_rejects_unowned_team(client, monkeypatch, _ownership_setup):
    """In prod mode, user cannot access a team they don't own."""
    from app.config import settings

    monkeypatch.setattr(settings, "AUTH_SECRET", "test-secret")

    setup = _ownership_setup
    response = await client.get(
        "/api/draft-queue",
        headers={
            "X-User-Email": setup["user"].email,
            "X-Team-Id": str(setup["team2"].id),
        },
    )
    assert response.status_code == 403
    assert "access" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_dev_mode_skips_ownership_check(client, monkeypatch, _ownership_setup):
    """In dev mode (AUTH_SECRET empty), ownership check is skipped for all teams."""
    from app.api.dependencies import get_current_user
    from app.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "AUTH_SECRET", "")

    setup = _ownership_setup

    # Override get_current_user so dev bypass works (returns the test user directly)
    async def _override_get_current_user():
        return setup["user"]

    app.dependency_overrides[get_current_user] = _override_get_current_user
    try:
        # team1 is accessible (user owns it)
        resp1 = await client.get(
            "/api/draft-queue",
            headers={"X-Team-Id": str(setup["team1"].id)},
        )
        assert resp1.status_code == 200

        # team2 is ALSO accessible because dev mode skips ownership check
        resp2 = await client.get(
            "/api/draft-queue",
            headers={"X-Team-Id": str(setup["team2"].id)},
        )
        assert resp2.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
