"""Tests for scrape_and_persist_lineups (DB persistence of Score-It lineups).

Network is mocked by monkeypatching httpx.AsyncClient, matching the roster
scrape tests. The real AG fixture drives the happy path.
"""

import logging
from datetime import date
from pathlib import Path

import httpx
import pytest
from sqlalchemy import func, select

from app.models import GameLineup, League, Player, PlayerRoster, RosterStatus, Team
from app.services.scoresheet_scraper import (
    resolve_pins_to_player_ids,
    scrape_and_persist_lineups,
    score_it_url,
)
from app.services.scoresheet_scraper.lineup_parser import parse_score_it_js

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "al_catfish_hunter_AG.js"
REAL_JS = FIXTURE.read_text()


def _mock_client(status: int, text: str = "", capture: list | None = None):
    class _Client:
        async def get(self, url, **kwargs):
            if capture is not None:
                capture.append(url)
            return httpx.Response(status, text=text, request=httpx.Request("GET", url))

    class _Factory:
        def __call__(self, *a, **kw):
            return self

        async def __aenter__(self):
            return _Client()

        async def __aexit__(self, *a):
            pass

    return _Factory()


async def _seed_league(db_session, data_path="FOR_WWW1/AL_Test", n_teams=10, league_type="AL"):
    league = League(name="AL Lineup Test", season=2026, league_type=league_type,
                    scoresheet_data_path=data_path)
    db_session.add(league)
    await db_session.flush()
    teams = []
    for i in range(1, n_teams + 1):
        team = Team(league_id=league.id, name=f"Team #{i}", scoresheet_id=i)
        db_session.add(team)
        teams.append(team)
    await db_session.flush()
    return league, teams


async def _seed_players_for_pins(db_session, pins, league_type="AL"):
    players = {}
    for pin in pins:
        # players.check_has_identifier requires scoresheet_id or mlb_id; NL pins
        # live in scoresheet_nl_id so give NL players an mlb_id.
        kwargs = (
            {"scoresheet_nl_id": pin, "mlb_id": 500000 + pin}
            if league_type == "NL"
            else {"scoresheet_id": pin}
        )
        p = Player(first_name="P", last_name=f"_{pin}", primary_position="OF", **kwargs)
        db_session.add(p)
        players[pin] = p
    await db_session.flush()
    return players


def _all_fixture_pins():
    parsed = parse_score_it_js(REAL_JS)
    pins = set()
    for g in parsed.games:
        pins.update(e.pin for e in g.visitor_lineup)
        pins.update(e.pin for e in g.home_lineup)
        pins.update(e.pin for e in g.substitutions)
    return pins


class TestScoreItUrl:
    def test_for_www1_maps_to_for_www2(self):
        assert score_it_url("FOR_WWW1/AL_Catfish_Hunter") == (
            "https://www.scoresheet.com/FOR_WWW2/AG_AL_Catfish_Hunter.js"
        )

    def test_other_dirs_unchanged(self):
        assert score_it_url("CWWW/Central_X").endswith("/CWWW/AG_Central_X.js")


class TestScrapeAndPersistLineups:
    @pytest.mark.asyncio
    async def test_happy_path_persists_starters_and_attributed_subs(self, db_session, monkeypatch):
        league, teams = await _seed_league(db_session)
        pins = _all_fixture_pins()
        players = await _seed_players_for_pins(db_session, pins)

        # Roster every fixture player on the team whose starting lineup they appear in
        # so substitutions can be attributed. Game 0's visitor is team index 8 (Team #9).
        parsed = parse_score_it_js(REAL_JS)
        pin_team: dict[int, int] = {}
        for g in parsed.games:
            for e in g.visitor_lineup:
                pin_team.setdefault(e.pin, g.visitor_idx + 1)
            for e in g.home_lineup:
                pin_team.setdefault(e.pin, g.home_idx + 1)
        # Reliever pin 245 never starts, so roster him explicitly on Team #1 (home in game 0).
        pin_team[245] = 1
        team_by_ssid = {t.scoresheet_id: t for t in teams}
        for pin, ssid in pin_team.items():
            db_session.add(PlayerRoster(
                player_id=players[pin].id, team_id=team_by_ssid[ssid].id,
                league_id=league.id, status=RosterStatus.ROSTERED,
            ))
        await db_session.flush()

        urls: list[str] = []
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(200, REAL_JS, urls))

        summary = await scrape_and_persist_lineups(db_session, league)

        assert urls == ["https://www.scoresheet.com/FOR_WWW2/AG_AL_Test.js"]
        assert summary["week_end"] == "2026-09-20"
        assert summary["games"] == 30
        assert summary["unresolved_pins"] == 0
        # 30 games x 2 teams x 10 starters = 600 starter rows, plus attributed subs
        assert summary["rows_written"] >= 600
        assert summary["rows_written"] - 600 + summary["unassigned_subs"] == 171

        starters = (await db_session.execute(
            select(func.count()).select_from(GameLineup).where(GameLineup.is_starter.is_(True))
        )).scalar_one()
        assert starters == 600

        # Game 0 visitor (Team #9): leadoff LF pin 623, SP pin 156, home side flagged.
        game0 = (await db_session.execute(
            select(GameLineup).where(
                GameLineup.game_no == 0,
                GameLineup.team_id == team_by_ssid[9].id,
                GameLineup.is_starter.is_(True),
            ).order_by(GameLineup.slot)
        )).scalars().all()
        assert [r.pin for r in game0][:2] == [623, 675]
        assert game0[9].pin == 156 and game0[9].slot == 9
        assert game0[0].is_home is False
        assert game0[0].opponent_team_id == team_by_ssid[1].id
        assert game0[0].player_id == players[623].id
        assert game0[0].week_end == date(2026, 9, 20)

        # Reliever pin 245 was attributed to Team #1 (home) via its roster.
        sub = (await db_session.execute(
            select(GameLineup).where(
                GameLineup.game_no == 0, GameLineup.pin == 245, GameLineup.is_starter.is_(False)
            )
        )).scalar_one()
        assert sub.team_id == team_by_ssid[1].id
        assert sub.is_home is True

    @pytest.mark.asyncio
    async def test_rerun_is_idempotent_and_keeps_other_weeks(self, db_session, monkeypatch):
        league, teams = await _seed_league(db_session)
        # A prior week's row must survive a re-scrape of a different week.
        db_session.add(GameLineup(
            league_id=league.id, week_end=date(2026, 9, 13), game_no=0, team_id=teams[0].id,
            opponent_team_id=teams[1].id, is_home=True, seq=0, slot=0, position_code=6,
            pin=1, player_id=None, is_starter=True,
        ))
        await db_session.flush()
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(200, REAL_JS))

        first = await scrape_and_persist_lineups(db_session, league)
        second = await scrape_and_persist_lineups(db_session, league)
        assert first["rows_written"] == second["rows_written"]

        total = (await db_session.execute(select(func.count()).select_from(GameLineup))).scalar_one()
        assert total == second["rows_written"] + 1
        prior = (await db_session.execute(
            select(func.count()).select_from(GameLineup).where(GameLineup.week_end == date(2026, 9, 13))
        )).scalar_one()
        assert prior == 1

    @pytest.mark.asyncio
    async def test_unresolved_pins_kept_with_null_player_and_warned(self, db_session, monkeypatch, caplog):
        league, _ = await _seed_league(db_session)
        # No players seeded at all.
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(200, REAL_JS))
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.service"):
            summary = await scrape_and_persist_lineups(db_session, league)
        assert summary["unresolved_pins"] == len(_all_fixture_pins())
        assert summary["unassigned_subs"] == 171  # subs need a player to attribute
        assert summary["rows_written"] == 600
        null_players = (await db_session.execute(
            select(func.count()).select_from(GameLineup).where(GameLineup.player_id.is_(None))
        )).scalar_one()
        assert null_players == 600
        assert any("unresolved pins" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_404_returns_empty_summary_without_error(self, db_session, monkeypatch, caplog):
        league, _ = await _seed_league(db_session)
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(404, "Not Found"))
        with caplog.at_level(logging.INFO, logger="app.services.scoresheet_scraper.service"):
            summary = await scrape_and_persist_lineups(db_session, league)
        assert summary == {
            "week_end": None, "games": 0, "rows_written": 0,
            "unresolved_pins": 0, "unassigned_subs": 0,
        }
        assert any("no Score-It file" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_non_404_http_error_raises(self, db_session, monkeypatch):
        league, _ = await _seed_league(db_session)
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(503, "down"))
        with pytest.raises(httpx.HTTPStatusError):
            await scrape_and_persist_lineups(db_session, league)

    @pytest.mark.asyncio
    async def test_missing_thru_date_raises_value_error(self, db_session, monkeypatch):
        league, _ = await _seed_league(db_session)
        js_no_date = REAL_JS.replace("var thru_date_", "var other_")
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(200, js_no_date))
        with pytest.raises(ValueError, match="thru_date_"):
            await scrape_and_persist_lineups(db_session, league)

    @pytest.mark.asyncio
    async def test_no_games_returns_summary_and_does_not_delete(self, db_session, monkeypatch, caplog):
        league, teams = await _seed_league(db_session)
        db_session.add(GameLineup(
            league_id=league.id, week_end=date(2026, 9, 20), game_no=0, team_id=teams[0].id,
            opponent_team_id=teams[1].id, is_home=True, seq=0, slot=0, position_code=6,
            pin=1, player_id=None, is_starter=True,
        ))
        await db_session.flush()
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(200, 'var thru_date_ = "9-20-26";'))
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.service"):
            summary = await scrape_and_persist_lineups(db_session, league)
        assert summary["week_end"] == "2026-09-20"
        assert summary["games"] == 0
        remaining = (await db_session.execute(select(func.count()).select_from(GameLineup))).scalar_one()
        assert remaining == 1
        assert any("no parseable games" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_unknown_team_index_skips_game_with_warning(self, db_session, monkeypatch, caplog):
        league, _ = await _seed_league(db_session, n_teams=3)  # fixture references 10 teams
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _mock_client(200, REAL_JS))
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.service"):
            summary = await scrape_and_persist_lineups(db_session, league)
        # Only the Team #1 vs Team #3 series survives: 3 games in the fixture.
        assert summary["rows_written"] == 3 * 2 * 10
        assert any("unknown team index" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_requires_data_path(self, db_session):
        league = League(name="No Path", season=2026, league_type="AL")
        db_session.add(league)
        await db_session.flush()
        with pytest.raises(ValueError, match="scoresheet_data_path"):
            await scrape_and_persist_lineups(db_session, league)


class TestResolvePins:
    @pytest.mark.asyncio
    async def test_nl_league_uses_nl_ids(self, db_session):
        league, _ = await _seed_league(db_session, league_type="NL")
        players = await _seed_players_for_pins(db_session, {5, 6}, league_type="NL")
        mapping = await resolve_pins_to_player_ids(db_session, league, {5, 6, 7})
        assert mapping == {5: players[5].id, 6: players[6].id}

    @pytest.mark.asyncio
    async def test_empty_pins(self, db_session):
        league, _ = await _seed_league(db_session)
        assert await resolve_pins_to_player_ids(db_session, league, set()) == {}
