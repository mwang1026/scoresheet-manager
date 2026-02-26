"""Tests for seed_watchlist_queue script."""

from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models import DraftQueue, League, Player, Team, Watchlist
from app.scripts.seed_watchlist_queue import seed_watchlist_queue


@pytest.fixture
async def seeded_players(db_session):
    """Seed league, team, and players for watchlist/queue tests."""
    league = League(name="Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    team = Team(league_id=league.id, name="Test Team", scoresheet_id=1)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    # Create 10 hitters and 5 pitchers (with scoresheet_ids so they pass scoresheet_only())
    players = []
    for i in range(10):
        players.append(Player(
            first_name=f"Hitter{i}", last_name=f"Last{i}",
            scoresheet_id=100 + i, mlb_id=1000 + i,
            primary_position="SS" if i % 2 == 0 else "OF",
        ))
    for i in range(5):
        players.append(Player(
            first_name=f"Pitcher{i}", last_name=f"Last{i}",
            scoresheet_id=200 + i, mlb_id=2000 + i,
            primary_position="P",
        ))

    db_session.add_all(players)
    await db_session.commit()

    return team, players


class TestSeedWatchlistQueue:
    """Tests for seed_watchlist_queue async function."""

    @pytest.mark.asyncio
    async def test_seeds_watchlist_and_queue(self, db_session, make_mock_get_session, seeded_players):
        """Creates watchlist entries for hitters + pitchers, and queue subset."""
        team, players = seeded_players

        with (
            patch("app.scripts.seed_watchlist_queue.get_session", make_mock_get_session()),
            patch.dict("os.environ", {"DEFAULT_TEAM_ID": str(team.id)}),
        ):
            await seed_watchlist_queue()

        watchlist = (await db_session.execute(select(Watchlist))).scalars().all()
        queue = (await db_session.execute(select(DraftQueue))).scalars().all()

        # Should have watchlist entries (up to 20 hitters + 10 pitchers, we have 10+5)
        assert len(watchlist) == 15  # 10 hitters + 5 pitchers
        assert len(queue) == 10  # 5 hitters + 5 pitchers

        # All should be for the correct team
        assert all(w.team_id == team.id for w in watchlist)
        assert all(q.team_id == team.id for q in queue)

    @pytest.mark.asyncio
    async def test_idempotent(self, db_session, make_mock_get_session, seeded_players):
        """Running twice should not duplicate entries (on_conflict_do_nothing)."""
        team, players = seeded_players

        with (
            patch("app.scripts.seed_watchlist_queue.get_session", make_mock_get_session()),
            patch.dict("os.environ", {"DEFAULT_TEAM_ID": str(team.id)}),
        ):
            await seed_watchlist_queue()
            await seed_watchlist_queue()

        watchlist = (await db_session.execute(select(Watchlist))).scalars().all()
        queue = (await db_session.execute(select(DraftQueue))).scalars().all()

        assert len(watchlist) == 15
        assert len(queue) == 10

    @pytest.mark.asyncio
    async def test_queue_has_ranks(self, db_session, make_mock_get_session, seeded_players):
        """Draft queue entries should have sequential rank values."""
        team, players = seeded_players

        with (
            patch("app.scripts.seed_watchlist_queue.get_session", make_mock_get_session()),
            patch.dict("os.environ", {"DEFAULT_TEAM_ID": str(team.id)}),
        ):
            await seed_watchlist_queue()

        queue = (await db_session.execute(
            select(DraftQueue).order_by(DraftQueue.rank)
        )).scalars().all()

        ranks = [q.rank for q in queue]
        assert ranks == list(range(10))
