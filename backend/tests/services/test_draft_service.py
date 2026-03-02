"""
Tests for the draft scraper service.

All HTTP calls are mocked via monkeypatch — no network calls.
"""

import logging
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

# Completed pick from round 10 — before the window (start_r1=14)
TRANSACTIONS_JS_PRIOR_WINDOW = """\
round1_=10;
p(8,100);
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


async def _create_players_for_transactions(db_session):
    """Create players matching TRANSACTIONS_JS SSIDs (100, 200)."""
    p1 = Player(first_name="Player", last_name="One", scoresheet_id=100, primary_position="OF")
    p2 = Player(first_name="Player", last_name="Two", scoresheet_id=200, primary_position="1B")
    db_session.add_all([p1, p2])
    await db_session.flush()
    return p1, p2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_persist_schedule(db_session, monkeypatch):
    """scrape_and_persist_draft creates DraftSchedule rows."""
    league, teams = await _setup_league_with_teams(db_session)
    # Create players so completed picks get marked
    p1, p2 = await _create_players_for_transactions(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["cooldown_skipped"] is False
    assert summary["upcoming_picks"] > 0

    # Verify total rows (upcoming + completed) exist in DB
    result = await db_session.execute(
        select(DraftSchedule).where(DraftSchedule.league_id == league.id)
    )
    all_rows = result.scalars().all()
    picked_rows = [r for r in all_rows if r.picked_player_id is not None]
    upcoming_rows = [r for r in all_rows if r.picked_player_id is None]

    assert len(picked_rows) == 2
    assert len(upcoming_rows) == summary["upcoming_picks"]


@pytest.mark.asyncio
async def test_roster_completed_picks(db_session, monkeypatch):
    """Completed picks from -T.js are rostered."""
    league, teams = await _setup_league_with_teams(db_session)

    # Create players with scoresheet_ids matching TRANSACTIONS_JS
    p1, p2 = await _create_players_for_transactions(db_session)

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
    """Re-scraping preserves picked_player_id and does not re-roster."""
    league, teams = await _setup_league_with_teams(db_session)
    p1, p2 = await _create_players_for_transactions(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary1 = await scrape_and_persist_draft(db_session, league, force=True)
    assert summary1["players_rostered"] == 2

    summary2 = await scrape_and_persist_draft(db_session, league, force=True)

    # Same upcoming count, no duplicates
    assert summary1["upcoming_picks"] == summary2["upcoming_picks"]

    # No players re-rostered on second scrape
    assert summary2["players_rostered"] == 0

    # picked_player_id values survived the upsert
    result = await db_session.execute(
        select(DraftSchedule).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.isnot(None),
        )
    )
    picked_rows = result.scalars().all()
    assert len(picked_rows) == 2

    # Total rows unchanged
    total_result = await db_session.execute(
        select(DraftSchedule).where(DraftSchedule.league_id == league.id)
    )
    total_rows = total_result.scalars().all()
    assert len(total_rows) == summary2["upcoming_picks"] + 2


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
async def test_unresolved_ssid(db_session, monkeypatch, caplog):
    """Unresolved SSIDs are counted and warned about."""
    league, teams = await _setup_league_with_teams(db_session)

    # Don't create players for SSIDs 100, 200 — they'll be unresolved
    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.draft_service"):
        summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["unresolved_players"] == 2
    assert summary["players_rostered"] == 0

    ssid_warnings = [
        r for r in caplog.records if "not found in players table" in r.message
    ]
    assert len(ssid_warnings) == 2


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
async def test_unknown_team_number_in_upcoming_picks(db_session, monkeypatch, caplog):
    """Upcoming picks referencing unknown team_numbers are skipped with a warning."""
    # Create league with only 5 teams (not 10)
    league = League(
        name="Partial League",
        season=2026,
        league_type="AL",
        scoresheet_data_path="FOR_WWW1/AL_Partial",
    )
    db_session.add(league)
    await db_session.flush()

    for i in range(1, 6):
        db_session.add(Team(league_id=league.id, name=f"Team #{i}", scoresheet_id=i))
    await db_session.flush()

    # LEAGUE_JS references all 10 teams — teams 6-10 don't exist in DB
    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, None))
    _draft_cooldowns.pop(league.id, None)

    with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.draft_service"):
        await scrape_and_persist_draft(db_session, league, force=True)

    team_warnings = [
        r for r in caplog.records if "unknown team_number=" in r.message
    ]
    assert len(team_warnings) > 0


@pytest.mark.asyncio
async def test_missing_data_path_raises(db_session):
    """Raises ValueError for league without scoresheet_data_path."""
    league = League(name="Bad League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.flush()

    with pytest.raises(ValueError, match="no scoresheet_data_path"):
        await scrape_and_persist_draft(db_session, league, force=True)


# ---------------------------------------------------------------------------
# New tests for upsert / picked_player_id behavior
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_completed_picks_marked_on_schedule(db_session, monkeypatch):
    """Matching schedule rows get picked_player_id set, others stay NULL."""
    league, teams = await _setup_league_with_teams(db_session)
    p1, p2 = await _create_players_for_transactions(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    await scrape_and_persist_draft(db_session, league, force=True)

    # Check the specific schedule rows for the completed picks
    result = await db_session.execute(
        select(DraftSchedule).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.isnot(None),
        )
    )
    marked = result.scalars().all()
    assert len(marked) == 2

    marked_player_ids = {r.picked_player_id for r in marked}
    assert marked_player_ids == {p1.id, p2.id}

    # All other rows should have picked_player_id = NULL
    null_result = await db_session.execute(
        select(DraftSchedule).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.is_(None),
        )
    )
    null_rows = null_result.scalars().all()
    assert len(null_rows) > 0  # remaining picks are unmarked


@pytest.mark.asyncio
async def test_completed_picks_survive_rescrape(db_session, monkeypatch):
    """picked_player_id values survive re-scrape; no re-rostering."""
    league, teams = await _setup_league_with_teams(db_session)
    p1, p2 = await _create_players_for_transactions(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary1 = await scrape_and_persist_draft(db_session, league, force=True)
    assert summary1["players_rostered"] == 2

    # Second scrape — same data
    summary2 = await scrape_and_persist_draft(db_session, league, force=True)
    assert summary2["players_rostered"] == 0  # no re-rostering

    # picked_player_id values still present
    result = await db_session.execute(
        select(DraftSchedule).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.isnot(None),
        )
    )
    marked = result.scalars().all()
    assert len(marked) == 2
    assert {r.picked_player_id for r in marked} == {p1.id, p2.id}


@pytest.mark.asyncio
async def test_prior_window_pick_skipped(db_session, monkeypatch):
    """Completed pick from round before start_r1 is entirely skipped."""
    league, teams = await _setup_league_with_teams(db_session)
    p1 = Player(first_name="Player", last_name="One", scoresheet_id=100, primary_position="OF")
    db_session.add(p1)
    await db_session.flush()

    # TRANSACTIONS_JS_PRIOR_WINDOW has pick in round 10, window starts at 14
    monkeypatch.setattr(
        draft_service_module, "_fetch_draft_js",
        _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS_PRIOR_WINDOW),
    )
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    # Pick is processed but skipped (prior window)
    assert summary["completed_picks_processed"] == 1
    assert summary["players_rostered"] == 0
    assert summary["unresolved_players"] == 0

    # No schedule rows have picked_player_id set
    result = await db_session.execute(
        select(DraftSchedule).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.isnot(None),
        )
    )
    assert len(result.scalars().all()) == 0

    # No roster entries created
    roster_result = await db_session.execute(
        select(PlayerRoster).where(PlayerRoster.player_id == p1.id)
    )
    assert roster_result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_unresolved_player_does_not_mark_schedule(db_session, monkeypatch):
    """Unresolved SSID leaves the schedule row with picked_player_id = NULL."""
    league, teams = await _setup_league_with_teams(db_session)

    # Don't create player for SSID 100 — it will be unresolved
    monkeypatch.setattr(
        draft_service_module, "_fetch_draft_js",
        _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS),
    )
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)

    assert summary["unresolved_players"] == 2

    # All schedule rows should have picked_player_id = NULL
    result = await db_session.execute(
        select(DraftSchedule).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.isnot(None),
        )
    )
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_api_returns_only_upcoming_picks(db_session, monkeypatch, client):
    """Schedule endpoint filters out rows with picked_player_id set."""
    league, teams = await _setup_league_with_teams(db_session)
    p1, p2 = await _create_players_for_transactions(db_session)

    monkeypatch.setattr(draft_service_module, "_fetch_draft_js", _mock_fetch(LEAGUE_JS, TRANSACTIONS_JS))
    _draft_cooldowns.pop(league.id, None)

    summary = await scrape_and_persist_draft(db_session, league, force=True)
    assert summary["players_rostered"] == 2

    # Verify DB has both picked and upcoming rows
    all_result = await db_session.execute(
        select(DraftSchedule).where(DraftSchedule.league_id == league.id)
    )
    all_rows = all_result.scalars().all()
    total_count = len(all_rows)
    upcoming_count = summary["upcoming_picks"]
    assert total_count > upcoming_count  # some rows are marked

    # Hit the API endpoint
    response = await client.get(
        "/api/draft/schedule",
        headers={"X-League-ID": str(league.id)},
    )
    assert response.status_code == 200
    data = response.json()

    # API should return only upcoming picks (not marked ones)
    assert len(data["picks"]) == upcoming_count
