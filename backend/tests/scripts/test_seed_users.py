"""Tests for seed_users script."""

from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models import League, Team, User, UserTeam
from app.scripts.seed_users import seed_users


class TestSeedUsers:
    """Tests for seed_users async function."""

    @pytest.fixture
    async def seeded_league_and_team(self, db_session):
        """Seed a league + team for user tests."""
        league = League(name="Test League", season=2026, league_type="AL")
        db_session.add(league)
        await db_session.commit()
        await db_session.refresh(league)

        team = Team(league_id=league.id, name="Team One", scoresheet_id=1)
        db_session.add(team)
        await db_session.commit()
        await db_session.refresh(team)

        return league, team

    @pytest.mark.asyncio
    async def test_creates_user_and_association(self, db_session, make_mock_get_session, seeded_league_and_team):
        """Valid SEED_USERS entry creates User + UserTeam."""
        league, team = seeded_league_and_team

        mock_settings = type("Settings", (), {
            "SEED_USERS": "test@example.com:1:admin",
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 1
        assert users[0].email == "test@example.com"
        assert users[0].role == "admin"

        user_teams = (await db_session.execute(select(UserTeam))).scalars().all()
        assert len(user_teams) == 1
        assert user_teams[0].team_id == team.id

    @pytest.mark.asyncio
    async def test_no_op_when_seed_users_empty(self, db_session, make_mock_get_session):
        """Empty SEED_USERS skips without error."""
        mock_settings = type("Settings", (), {
            "SEED_USERS": "",
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_skips_invalid_entry_format(self, db_session, make_mock_get_session, seeded_league_and_team):
        """Entries with wrong format (not email:id:role) are skipped."""
        mock_settings = type("Settings", (), {
            "SEED_USERS": "bad-entry,also-bad",
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_skips_invalid_team_id(self, db_session, make_mock_get_session, seeded_league_and_team):
        """Non-numeric scoresheet_team_id is skipped."""
        mock_settings = type("Settings", (), {
            "SEED_USERS": "test@example.com:abc:admin",
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_handles_missing_league(self, db_session, make_mock_get_session):
        """Missing league logs error and returns early."""
        mock_settings = type("Settings", (), {
            "SEED_USERS": "test@example.com:1:admin",
            "SEED_LEAGUE_NAME": "Nonexistent League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_handles_missing_team(self, db_session, make_mock_get_session):
        """Valid user entry but nonexistent team is skipped."""
        # Seed league only (no team with scoresheet_id=99)
        league = League(name="Test League", season=2026, league_type="AL")
        db_session.add(league)
        await db_session.commit()

        mock_settings = type("Settings", (), {
            "SEED_USERS": "test@example.com:99:admin",
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        # User should NOT be created since team was missing
        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 0

    @pytest.mark.asyncio
    async def test_multiple_users(self, db_session, make_mock_get_session):
        """Multiple comma-separated entries create multiple users."""
        league = League(name="Test League", season=2026, league_type="AL")
        db_session.add(league)
        await db_session.commit()
        await db_session.refresh(league)

        team1 = Team(league_id=league.id, name="Team One", scoresheet_id=1)
        team2 = Team(league_id=league.id, name="Team Two", scoresheet_id=2)
        db_session.add_all([team1, team2])
        await db_session.commit()

        mock_settings = type("Settings", (), {
            "SEED_USERS": "alice@test.com:1:admin,bob@test.com:2:user",
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_users.get_session", make_mock_get_session()),
            patch("app.scripts.seed_users.settings", mock_settings),
        ):
            await seed_users()

        users = (await db_session.execute(select(User))).scalars().all()
        assert len(users) == 2
        emails = {u.email for u in users}
        assert emails == {"alice@test.com", "bob@test.com"}
