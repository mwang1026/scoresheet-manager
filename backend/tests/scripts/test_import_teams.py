"""Tests for import_teams script."""

import json
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import League, Team
from app.scripts.import_teams import import_teams

SAMPLE_TEAMS = [
    {"name": "Team Alpha", "scoresheet_team_id": 1, "is_my_team": True},
    {"name": "Team Bravo", "scoresheet_team_id": 2, "is_my_team": False},
    {"name": "Team Charlie", "scoresheet_team_id": 3, "is_my_team": False},
]


class TestImportTeams:
    """Tests for import_teams async function."""

    @pytest.mark.asyncio
    async def test_creates_teams_from_json(self, db_session, make_mock_get_session, tmp_path):
        """import_teams reads teams.json and creates teams linked to league."""
        # Seed league
        league = League(name="Test League", season=2026, league_type="AL")
        db_session.add(league)
        await db_session.commit()
        await db_session.refresh(league)

        # Create fixture file at path the script will discover
        fixture_dir = tmp_path / "frontend" / "lib" / "fixtures"
        fixture_dir.mkdir(parents=True)
        (fixture_dir / "teams.json").write_text(json.dumps(SAMPLE_TEAMS))

        # Point __file__ so Path(__file__).resolve().parent.parent.parent.parent == tmp_path
        fake_file = str(tmp_path / "backend" / "app" / "scripts" / "import_teams.py")

        with (
            patch("app.scripts.import_teams.get_session", make_mock_get_session()),
            patch.dict("os.environ", {"SEED_LEAGUE_NAME": "Test League"}),
            patch("app.scripts.import_teams.__file__", fake_file),
        ):
            await import_teams()

        result = await db_session.execute(select(Team))
        teams = result.scalars().all()
        assert len(teams) == 3
        assert {t.name for t in teams} == {"Team Alpha", "Team Bravo", "Team Charlie"}
        assert all(t.league_id == league.id for t in teams)

    @pytest.mark.asyncio
    async def test_returns_early_when_league_not_found(self, db_session, make_mock_get_session, tmp_path):
        """import_teams returns early when league doesn't exist (no crash)."""
        fixture_dir = tmp_path / "frontend" / "lib" / "fixtures"
        fixture_dir.mkdir(parents=True)
        (fixture_dir / "teams.json").write_text(json.dumps(SAMPLE_TEAMS))

        fake_file = str(tmp_path / "backend" / "app" / "scripts" / "import_teams.py")

        with (
            patch("app.scripts.import_teams.get_session", make_mock_get_session()),
            patch.dict("os.environ", {"SEED_LEAGUE_NAME": "Nonexistent League"}),
            patch("app.scripts.import_teams.__file__", fake_file),
        ):
            await import_teams()

        result = await db_session.execute(select(Team))
        assert result.scalars().all() == []

    @pytest.mark.asyncio
    async def test_upsert_updates_team_names(self, db_session):
        """Re-importing with same scoresheet_id updates team name."""
        league = League(name="Test League", season=2026, league_type="AL")
        db_session.add(league)
        await db_session.commit()
        await db_session.refresh(league)

        # Create initial team
        team = Team(league_id=league.id, name="Old Name", scoresheet_id=1)
        db_session.add(team)
        await db_session.commit()

        # Upsert with new name (same logic import_teams uses)
        stmt = insert(Team.__table__).values(
            league_id=league.id, name="New Name", scoresheet_id=1,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["league_id", "scoresheet_id"],
            set_={"name": stmt.excluded.name},
        )
        await db_session.execute(stmt)
        await db_session.commit()

        db_session.expire_all()
        result = await db_session.execute(select(Team).where(Team.scoresheet_id == 1))
        assert result.scalar_one().name == "New Name"

    @pytest.mark.asyncio
    async def test_file_not_found_raises(self, db_session, make_mock_get_session, tmp_path):
        """FileNotFoundError when teams.json doesn't exist."""
        # Don't create the fixture file — should raise
        fake_file = str(tmp_path / "backend" / "app" / "scripts" / "import_teams.py")

        with (
            patch("app.scripts.import_teams.get_session", make_mock_get_session()),
            patch.dict("os.environ", {"SEED_LEAGUE_NAME": "Test League"}),
            patch("app.scripts.import_teams.__file__", fake_file),
            pytest.raises(FileNotFoundError),
        ):
            await import_teams()
