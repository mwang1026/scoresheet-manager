"""
Tests for the draft scraper service.

All HTTP calls are mocked via monkeypatch — no network calls.
"""

from datetime import datetime, timezone

import httpx
import pytest
from sqlalchemy import select

import app.services.scoresheet_scraper.draft_service as draft_service_module
from app.models import DraftSchedule, League, Player, PlayerRoster, RosterStatus, Team
from app.services.scoresheet_scraper.draft_service import (
    _draft_cooldowns,
    scrape_and_persist_draft,
)


# ---------------------------------------------------------------------------
# Inline JS fixtures
# ---------------------------------------------------------------------------

LEAGUE_JS = """
var lg_ = {
  owner_names : ["Alice","Bob","Carol","Dave","Eve","Frank","Grace","Henry","Irene","Jack"],
  picks_sched: { last_pt: 1774059900, last_r1: 17, start_r1: 14,
                 n_skips_todo: 0, total_pt: 500000 },
  t1a_odd_r1: [8,5,9,10,6,7,3,2,4,1],
  t1a_even_r1: [1,4,2,3,7,6,10,9,5,8],
  n_picks_done: 10,
  round1_: 14,
  rosters: [
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] }
  ]
};
"""

TRANSACTIONS_JS = """\
round1_=14;
p(8,100);
p(5,200);
"""

TRANSACTIONS_JS_WITH_NL = """\
round1_=14;
p(8,500);
"""

LEAGUE_JS_DRAFT_COMPLETE = """
var lg_ = {
  owner_names : ["Alice","Bob","Carol","Dave","Eve","Frank","Grace","Henry","Irene","Jack"],
  t1a_odd_r1: [8,5,9,10,6,7,3,2,4,1],
  t1a_even_r1: [1,4,2,3,7,6,10,9,5,8],
  n_picks_done: 220,
  round1_: 14,
  rosters: [
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] },
    { pins: [], omit_r1s: [], extra_picks: [] }
  ]
};
"""

TRANSACTIONS_JS_COMPLETE = """\
round1_=35;
p(1,999);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_fetch(league_js: str, trans_js: str | None):
    """Create a mock replacement for _fetch_draft_js."""
    async def mock_fetch_draft_js(data_path: str) -> tuple[str, str | None]:
        return league_js, trans_js
    return mock_fetch_draft_js


async def _setup_league_with_teams(db_session, *, league_type="AL", data_path="FOR_WWW1/AL_Test"):
    """Create a league with 10 teams."""
    league = League(
        name="Test League",
        season=2026,
        league_type=league_type,
        scoresheet_data_path=data_path,
    )
    db_session.add(league)
    await db_session.flush()

    teams = []
    for i in range(1, 11):
        team = Team(league_id=league.id, name=f"Team #{i}", scoresheet_id=i)
        db_session.add(team)
        teams.append(team)
    await db_session.flush()
    for t in teams:
        await db_session.refresh(t)

    return league, teams


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_persist_schedule(db_session, monkeypatch):
    """scrape_and_persist_draft creates DraftSchedule rows."""
    league, teams = await _setup_league_with_teams(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["cooldown_skipped"] is False
    assert summary["upcoming_picks"] > 0

    # Verify rows exist in DB
    result = await db_session.execute(
        select(DraftSchedule).where(DraftSchedule.league_id == league.id)
    )
    rows = result.scalars().all()
    assert len(rows) == summary["upcoming_picks"]


@pytest.mark.asyncio
async def test_roster_completed_picks(db_session, monkeypatch):
    """Completed picks from -T.js are rostered."""
    league, teams = await _setup_league_with_teams(db_session)

    # Create players with scoresheet_ids matching TRANSACTIONS_JS
    p1 = Player(first_name="Player", last_name="One", scoresheet_id=100, primary_position="OF")
    p2 = Player(first_name="Player", last_name="Two", scoresheet_id=200, primary_position="1B")
    db_session.add_all([p1, p2])
    await db_session.flush()

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["players_rostered"] == 2
    assert summary["completed_picks_processed"] == 2

    # Verify roster entries
    roster_result = await db_session.execute(
        select(PlayerRoster).where(PlayerRoster.player_id.in_([p1.id, p2.id]))
    )
    roster_entries = roster_result.scalars().all()
    assert len(roster_entries) == 2
    assert all(r.status == RosterStatus.ROSTERED for r in roster_entries)


@pytest.mark.asyncio
async def test_cooldown_skips_scrape(db_session, monkeypatch):
    """Scrape is skipped when within cooldown period."""
    league, teams = await _setup_league_with_teams(db_session)

    # Set recent cooldown
    _draft_cooldowns[league.id] = datetime.now(timezone.utc)

    summary = await scrape_and_persist_draft(db_session, league, force=False)

    assert summary["cooldown_skipped"] is True
    assert summary["upcoming_picks"] == 0

    # Cleanup
    _draft_cooldowns.pop(league.id, None)


@pytest.mark.asyncio
async def test_force_bypasses_cooldown(db_session, monkeypatch):
    """force=True bypasses cooldown."""
    league, teams = await _setup_league_with_teams(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))

    # Set recent cooldown
    _draft_cooldowns[league.id] = datetime.now(timezone.utc)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["cooldown_skipped"] is False
    assert summary["upcoming_picks"] > 0

    # Cleanup
    _draft_cooldowns.pop(league.id, None)


@pytest.mark.asyncio
async def test_idempotent_rescrape(db_session, monkeypatch):
    """Re-scraping replaces schedule rows (no duplicates)."""
    league, teams = await _setup_league_with_teams(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary1 = await scrape_and_persist_draft(db_session, league, force=True)
    summary2 = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary1["upcoming_picks"] == summary2["upcoming_picks"]

    result = await db_session.execute(
        select(DraftSchedule).where(DraftSchedule.league_id == league.id)
    )
    rows = result.scalars().all()
    assert len(rows) == summary2["upcoming_picks"]


@pytest.mark.asyncio
async def test_draft_complete_flag(db_session, monkeypatch):
    """draft_complete is set when no picks_sched and completed picks exist."""
    league, teams = await _setup_league_with_teams(db_session)

    monkeypatch.setattr(
        draft_service_module, "_fetch_draft_js",
        _mock_fetch(LEAGUE_JS_DRAFT_COMPLETE, TRANSACTIONS_JS_COMPLETE),
    )
    _draft_cooldowns.pop(league.id, None)

    await scrape_and_persist_draft(db_session, league, force=True)

    await db_session.refresh(league)
    assert league.draft_complete is True


@pytest.mark.asyncio
async def test_unresolved_ssid(db_session, monkeypatch):
    """Unresolved SSIDs are counted but don't cause failures."""
    league, teams = await _setup_league_with_teams(db_session)

    # Don't create players for SSIDs 100, 200 — they'll be unresolved
    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["unresolved_players"] == 2
    assert summary["players_rostered"] == 0


@pytest.mark.asyncio
async def test_nl_league_uses_scoresheet_nl_id(db_session, monkeypatch):
    """NL league looks up players by scoresheet_nl_id."""
    league, teams = await _setup_league_with_teams(
        db_session, league_type="NL", data_path="FOR_WWW1/NL_Test"
    )

    # Player has scoresheet_nl_id=500 (matching TRANSACTIONS_JS_WITH_NL)
    player = Player(
        first_name="NL", last_name="Player",
        scoresheet_id=50, scoresheet_nl_id=500,
        primary_position="OF",
    )
    db_session.add(player)
    await db_session.flush()

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS_WITH_NL))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["players_rostered"] == 1

    # Verify roster entry is for the NL player
    result = await db_session.execute(
        select(PlayerRoster).where(PlayerRoster.player_id == player.id)
    )
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_no_transactions_file(db_session, monkeypatch):
    """Handles missing -T.js (draft hasn't started yet)."""
    league, teams = await _setup_league_with_teams(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, None))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["completed_picks_processed"] == 0
    assert summary["upcoming_picks"] > 0


@pytest.mark.asyncio
async def test_missing_data_path_raises(db_session):
    """Raises ValueError for league without scoresheet_data_path."""
    league = League(name="Bad League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    with pytest.raises(ValueError, match="no scoresheet_data_path"):
        await scrape_and_persist_draft(db_session, league, force=True)
