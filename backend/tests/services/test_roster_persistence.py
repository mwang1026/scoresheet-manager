"""
Integration tests for roster scraping and DB persistence.

These tests call scrape_and_persist_rosters() with a real in-memory SQLite
database. The HTTP layer is mocked via unittest.mock.patch so no network
calls are made.
"""

from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import League, Player, PlayerRoster, RosterStatus, Team
from app.services.scoresheet_scraper import scrape_and_persist_rosters


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def make_mock_httpx_client(js_content: str):
    """Returns a mock AsyncClient class that serves js_content for any GET."""

    class MockResponse:
        text = js_content

        def raise_for_status(self) -> None:
            pass

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, **kwargs):
            return MockResponse()

    return MockAsyncClient


async def _create_league(
    session: AsyncSession,
    name: str = "AL Test League",
    league_type: str = "AL",
    data_path: str = "FOR_WWW1/AL_Test",
) -> League:
    league = League(
        name=name,
        season=2026,
        scoresheet_data_path=data_path,
        league_type=league_type,
    )
    session.add(league)
    await session.commit()
    await session.refresh(league)
    return league


async def _create_team(
    session: AsyncSession, league: League, scoresheet_id: int
) -> Team:
    team = Team(
        league_id=league.id,
        name=f"Team {scoresheet_id}",
        scoresheet_id=scoresheet_id,
    )
    session.add(team)
    await session.commit()
    await session.refresh(team)
    return team


async def _create_player(
    session: AsyncSession,
    scoresheet_id: int | None = None,
    scoresheet_nl_id: int | None = None,
) -> Player:
    player = Player(
        first_name="Player",
        last_name=f"SS{scoresheet_id or scoresheet_nl_id}",
        scoresheet_id=scoresheet_id,
        scoresheet_nl_id=scoresheet_nl_id,
        mlb_id=scoresheet_id or scoresheet_nl_id,
        primary_position="OF",
    )
    session.add(player)
    await session.commit()
    await session.refresh(player)
    return player


async def _get_rosters(session: AsyncSession, team_ids: list[int]) -> list[PlayerRoster]:
    result = await session.execute(
        select(PlayerRoster).where(PlayerRoster.team_id.in_(team_ids))
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_populates_empty_roster(db_session: AsyncSession):
    """Roster rows are inserted for all resolved pins."""
    js = """
    lg_ = {
      rosters: [
        { pins: [100, 101], psys: [] },
        { pins: [200, 201], psys: [] },
      ],
    };
    """
    league = await _create_league(db_session)
    team1 = await _create_team(db_session, league, scoresheet_id=1)
    team2 = await _create_team(db_session, league, scoresheet_id=2)
    player100 = await _create_player(db_session, scoresheet_id=100)
    player101 = await _create_player(db_session, scoresheet_id=101)
    player200 = await _create_player(db_session, scoresheet_id=200)
    player201 = await _create_player(db_session, scoresheet_id=201)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        result = await scrape_and_persist_rosters(db_session, league)

    rows = await _get_rosters(db_session, [team1.id, team2.id])
    assert len(rows) == 4
    assert result["teams_processed"] == 2
    assert result["players_added"] == 4
    assert result["players_removed"] == 0
    assert result["unresolved_pins"] == 0

    team_player_pairs = {(r.team_id, r.player_id) for r in rows}
    assert (team1.id, player100.id) in team_player_pairs
    assert (team1.id, player101.id) in team_player_pairs
    assert (team2.id, player200.id) in team_player_pairs
    assert (team2.id, player201.id) in team_player_pairs


@pytest.mark.asyncio
async def test_roster_rows_have_correct_status(db_session: AsyncSession):
    """Inserted rows have status='rostered' and a non-null added_date."""
    from datetime import date

    js = "lg_ = { rosters: [ { pins: [100], psys: [] } ] };"
    league = await _create_league(db_session)
    await _create_team(db_session, league, scoresheet_id=1)
    await _create_player(db_session, scoresheet_id=100)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        await scrape_and_persist_rosters(db_session, league)

    result = await db_session.execute(select(PlayerRoster))
    rows = list(result.scalars().all())
    assert len(rows) == 1
    assert rows[0].status == RosterStatus.ROSTERED
    assert rows[0].added_date is not None
    assert rows[0].dropped_date is None


@pytest.mark.asyncio
async def test_rescrape_same_data_is_idempotent(db_session: AsyncSession):
    """Running the scraper twice with the same JS produces the same rows."""
    js = """
    lg_ = {
      rosters: [
        { pins: [100, 101], psys: [] },
      ],
    };
    """
    league = await _create_league(db_session)
    await _create_team(db_session, league, scoresheet_id=1)
    await _create_player(db_session, scoresheet_id=100)
    await _create_player(db_session, scoresheet_id=101)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        await scrape_and_persist_rosters(db_session, league)

    result = await db_session.execute(select(PlayerRoster))
    count_after_first = len(result.scalars().all())

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        await scrape_and_persist_rosters(db_session, league)

    result = await db_session.execute(select(PlayerRoster))
    count_after_second = len(result.scalars().all())

    assert count_after_first == count_after_second == 2


@pytest.mark.asyncio
async def test_rescrape_removes_dropped_players(db_session: AsyncSession):
    """Players no longer in the JS are removed from player_roster."""
    js_first = """
    lg_ = { rosters: [ { pins: [100, 101, 102], psys: [] } ] };
    """
    js_second = """
    lg_ = { rosters: [ { pins: [100], psys: [] } ] };
    """
    league = await _create_league(db_session)
    team = await _create_team(db_session, league, scoresheet_id=1)
    await _create_player(db_session, scoresheet_id=100)
    await _create_player(db_session, scoresheet_id=101)
    await _create_player(db_session, scoresheet_id=102)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js_first)):
        result1 = await scrape_and_persist_rosters(db_session, league)

    assert result1["players_added"] == 3

    with patch("httpx.AsyncClient", make_mock_httpx_client(js_second)):
        result2 = await scrape_and_persist_rosters(db_session, league)

    rows = await _get_rosters(db_session, [team.id])
    assert len(rows) == 1
    assert result2["players_removed"] == 2
    assert result2["players_added"] == 0


@pytest.mark.asyncio
async def test_rescrape_updates_traded_players(db_session: AsyncSession):
    """A player traded from team 1 to team 2 is reflected after re-scrape."""
    js_before = """
    lg_ = {
      rosters: [
        { pins: [100, 101], psys: [] },
        { pins: [200], psys: [] },
      ],
    };
    """
    # Player 100 moves from team 1 to team 2
    js_after = """
    lg_ = {
      rosters: [
        { pins: [101], psys: [] },
        { pins: [200, 100], psys: [] },
      ],
    };
    """
    league = await _create_league(db_session)
    team1 = await _create_team(db_session, league, scoresheet_id=1)
    team2 = await _create_team(db_session, league, scoresheet_id=2)
    player100 = await _create_player(db_session, scoresheet_id=100)
    await _create_player(db_session, scoresheet_id=101)
    await _create_player(db_session, scoresheet_id=200)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js_before)):
        await scrape_and_persist_rosters(db_session, league)

    # Confirm player100 is on team1
    result = await db_session.execute(
        select(PlayerRoster).where(PlayerRoster.player_id == player100.id)
    )
    row = result.scalar_one()
    assert row.team_id == team1.id

    with patch("httpx.AsyncClient", make_mock_httpx_client(js_after)):
        await scrape_and_persist_rosters(db_session, league)

    # Confirm player100 is now on team2
    result = await db_session.execute(
        select(PlayerRoster).where(PlayerRoster.player_id == player100.id)
    )
    row = result.scalar_one()
    assert row.team_id == team2.id


@pytest.mark.asyncio
async def test_unresolved_pins_dont_fail(db_session: AsyncSession):
    """Pins with no matching Player record are skipped; operation succeeds."""
    js = """
    lg_ = {
      rosters: [
        { pins: [100, 999], psys: [] },
      ],
    };
    """
    league = await _create_league(db_session)
    team = await _create_team(db_session, league, scoresheet_id=1)
    player100 = await _create_player(db_session, scoresheet_id=100)
    # Pin 999 has no matching player

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        result = await scrape_and_persist_rosters(db_session, league)

    assert result["unresolved_pins"] == 1
    rows = await _get_rosters(db_session, [team.id])
    assert len(rows) == 1
    assert rows[0].player_id == player100.id


@pytest.mark.asyncio
async def test_nl_league_uses_scoresheet_nl_id(db_session: AsyncSession):
    """NL league resolves pins via scoresheet_nl_id, not scoresheet_id."""
    js = """
    lg_ = {
      rosters: [
        { pins: [500, 501], psys: [] },
      ],
    };
    """
    league = await _create_league(
        db_session,
        name="NL Test League",
        league_type="NL",
        data_path="FOR_WWW1/NL_Test",
    )
    team = await _create_team(db_session, league, scoresheet_id=1)

    # Players have scoresheet_nl_id matching the pins; scoresheet_id is different
    player_a = await _create_player(db_session, scoresheet_id=None, scoresheet_nl_id=500)
    player_b = await _create_player(db_session, scoresheet_id=None, scoresheet_nl_id=501)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        result = await scrape_and_persist_rosters(db_session, league)

    rows = await _get_rosters(db_session, [team.id])
    assert len(rows) == 2
    assert result["unresolved_pins"] == 0

    player_ids = {r.player_id for r in rows}
    assert player_a.id in player_ids
    assert player_b.id in player_ids


@pytest.mark.asyncio
async def test_missing_data_path_raises_value_error(db_session: AsyncSession):
    """ValueError raised if league.scoresheet_data_path is None."""
    league = League(name="No Path", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    with pytest.raises(ValueError, match="scoresheet_data_path"):
        await scrape_and_persist_rosters(db_session, league)


@pytest.mark.asyncio
async def test_missing_league_type_raises_value_error(db_session: AsyncSession):
    """ValueError raised if league.league_type is None."""
    league = League(
        name="No Type", season=2026, scoresheet_data_path="FOR_WWW1/AL_Test"
    )
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    with pytest.raises(ValueError, match="league_type"):
        await scrape_and_persist_rosters(db_session, league)


@pytest.mark.asyncio
async def test_all_pins_unresolved_returns_empty_roster(db_session: AsyncSession):
    """If no pins match any players, roster table stays empty (no error)."""
    js = "lg_ = { rosters: [ { pins: [9991, 9992, 9993], psys: [] } ] };"
    league = await _create_league(db_session)
    team = await _create_team(db_session, league, scoresheet_id=1)

    with patch("httpx.AsyncClient", make_mock_httpx_client(js)):
        result = await scrape_and_persist_rosters(db_session, league)

    rows = await _get_rosters(db_session, [team.id])
    assert len(rows) == 0
    assert result["unresolved_pins"] == 3
    assert result["players_added"] == 0
