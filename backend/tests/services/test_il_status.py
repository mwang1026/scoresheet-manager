"""Tests for IL status fetcher service — mock HTTP, exercise real parsing."""

import logging
from datetime import date
from unittest.mock import patch

import httpx
import pytest
from sqlalchemy import select

from app.models.player import Player
from app.services.il_status import (
    ILEntry,
    fetch_and_persist_il_status,
    fetch_il_date,
    parse_il_entries,
)


# ---------------------------------------------------------------------------
# Mock HTTP helpers
# ---------------------------------------------------------------------------


class ILMockHttpClient:
    """
    Mock httpx client that routes responses by URL.

    /teams/ → roster response
    /people/ → transaction response
    """

    def __init__(
        self,
        roster_responses: dict[int, list[dict]] | None = None,
        transaction_responses: dict[int, dict] | None = None,
        team_errors: dict[int, Exception] | None = None,
        transaction_errors: dict[int, Exception] | None = None,
    ):
        self._roster_responses = roster_responses or {}
        self._transaction_responses = transaction_responses or {}
        self._team_errors = team_errors or {}
        self._transaction_errors = transaction_errors or {}
        self._request_counts: dict[str, int] = {}

    async def get(self, url: str, *args, **kwargs) -> httpx.Response:
        url_str = str(url)

        # Track requests for retry tests
        self._request_counts[url_str] = self._request_counts.get(url_str, 0) + 1

        if "/teams/" in url_str:
            # Extract team_id from URL
            team_id = int(url_str.split("/teams/")[1].split("/")[0])
            if team_id in self._team_errors:
                err = self._team_errors[team_id]
                # Allow callable for conditional errors (e.g., fail first, pass second)
                if callable(err):
                    err = err(self._request_counts[url_str])
                if err is not None:
                    raise err
            roster = self._roster_responses.get(team_id, [])
            return httpx.Response(
                200,
                json={"roster": roster},
                request=httpx.Request("GET", url_str),
            )

        if "/people/" in url_str:
            # Extract mlb_id from URL
            mlb_id = int(url_str.split("/people/")[1].split("?")[0])
            if mlb_id in self._transaction_errors:
                raise self._transaction_errors[mlb_id]
            txn_data = self._transaction_responses.get(
                mlb_id, {"people": [{"transactions": []}]}
            )
            return httpx.Response(
                200,
                json=txn_data,
                request=httpx.Request("GET", url_str),
            )

        return httpx.Response(404, request=httpx.Request("GET", url_str))


class _MockAsyncClientClass:
    """Replaces httpx.AsyncClient as a class that creates ILMockHttpClient."""

    def __init__(self, client: ILMockHttpClient):
        self._client = client

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self._client

    async def __aexit__(self, *args):
        pass


def _patch_httpx(mock_client: ILMockHttpClient):
    """Patch httpx.AsyncClient globally."""
    fake_cls = _MockAsyncClientClass(mock_client)
    return patch("httpx.AsyncClient", fake_cls)


# Use a small team set for tests to avoid 30-team overhead
TEST_TEAM_IDS = (108, 109)


def _patch_team_ids():
    """Reduce MLB_TEAM_IDS to 2 teams for faster tests."""
    return patch("app.services.il_status.MLB_TEAM_IDS", TEST_TEAM_IDS)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_player(
    db_session, first_name, last_name, team, scoresheet_id, mlb_id,
    position="OF", il_type=None, il_date=None,
):
    p = Player(
        first_name=first_name,
        last_name=last_name,
        current_mlb_team=team,
        scoresheet_id=scoresheet_id,
        mlb_id=mlb_id,
        primary_position=position,
        is_trade_bait=False,
        il_type=il_type,
        il_date=il_date,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


def _make_roster_entry(mlb_id, full_name, status_code, status_desc=None):
    """Build a single roster entry matching MLB API shape."""
    return {
        "person": {"id": mlb_id, "fullName": full_name},
        "status": {
            "code": status_code,
            "description": status_desc or f"Injured {status_code}",
        },
    }


def _make_transaction_response(mlb_id, effective_date, description):
    """Build MLB API transaction response."""
    return {
        "people": [{
            "transactions": [{
                "effectiveDate": effective_date,
                "typeCode": "SC",
                "description": description,
            }],
        }],
    }


# ---------------------------------------------------------------------------
# Tests — parse_il_entries
# ---------------------------------------------------------------------------


class TestParseILEntries:
    def test_filters_correctly(self):
        """Mix of active and IL players — only IL returned."""
        roster = [
            _make_roster_entry(100, "Active Guy", "A", "Active"),
            _make_roster_entry(200, "IL Guy", "D10", "10-Day Injured List"),
            _make_roster_entry(300, "Minors Guy", "MIN", "Minor League"),
            _make_roster_entry(400, "IL60 Guy", "D60", "60-Day Injured List"),
        ]
        entries = parse_il_entries(roster)
        assert len(entries) == 2
        assert entries[0].mlb_id == 200
        assert entries[0].il_type == "10-Day IL"
        assert entries[1].mlb_id == 400
        assert entries[1].il_type == "60-Day IL"

    def test_unknown_d_code_falls_back_to_description(self):
        """Unknown D-code uses status.description as fallback."""
        roster = [
            _make_roster_entry(500, "Unknown IL", "D99", "Paternity List"),
        ]
        entries = parse_il_entries(roster)
        assert len(entries) == 1
        assert entries[0].il_type == "Paternity List"


# ---------------------------------------------------------------------------
# Tests — fetch_il_date
# ---------------------------------------------------------------------------


class TestFetchILDate:
    @pytest.mark.asyncio
    async def test_parses_transaction(self):
        """Correct date parsed from IL placement transaction."""
        mock = ILMockHttpClient(
            transaction_responses={
                12345: _make_transaction_response(
                    12345,
                    "2026-06-15",
                    "Texas Rangers transferred to the 10-day injured list",
                ),
            }
        )
        result = await fetch_il_date(mock, 12345)
        assert result == date(2026, 6, 15)

    @pytest.mark.asyncio
    async def test_no_matching_transaction(self):
        """No IL transaction → returns None."""
        mock = ILMockHttpClient(
            transaction_responses={
                12345: {
                    "people": [{
                        "transactions": [{
                            "effectiveDate": "2026-06-15",
                            "typeCode": "SC",
                            "description": "Optioned to minor leagues",
                        }],
                    }],
                },
            }
        )
        result = await fetch_il_date(mock, 12345)
        assert result is None


# ---------------------------------------------------------------------------
# Tests — fetch_and_persist_il_status (integration)
# ---------------------------------------------------------------------------


class TestFetchAndPersistILStatus:
    @pytest.mark.asyncio
    async def test_sets_il_status(self, db_session):
        """Happy path: IL player matched to Scoresheet player gets IL fields set."""
        player = await _create_player(db_session, "Juan", "Soto", "NYY", 1001, 665742)

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(665742, "Juan Soto", "D10")],
                109: [],
            },
            transaction_responses={
                665742: _make_transaction_response(
                    665742, "2026-04-10",
                    "New York Yankees placed on the 10-day injured list",
                ),
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["teams_fetched"] == 2
        assert summary["scoresheet_matches"] == 1
        assert summary["players_added_to_il"] == 1

        await db_session.refresh(player)
        assert player.il_type == "10-Day IL"
        assert player.il_date == date(2026, 4, 10)

    @pytest.mark.asyncio
    async def test_clears_il_status_for_returned_player(self, db_session):
        """Player previously on IL, no longer in roster → IL cleared."""
        player = await _create_player(
            db_session, "Mike", "Trout", "LAA", 1002, 545361,
            il_type="10-Day IL", il_date=date(2026, 3, 1),
        )

        # Both rosters return empty — player no longer on IL
        mock = ILMockHttpClient(
            roster_responses={108: [], 109: []},
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["players_cleared_from_il"] == 1

        await db_session.refresh(player)
        assert player.il_type is None
        assert player.il_date is None

    @pytest.mark.asyncio
    async def test_two_way_player_both_entries_updated(self, db_session):
        """Two-way player (same mlb_id, two scoresheet entries) → both updated."""
        p_hitter = await _create_player(
            db_session, "Shohei", "Ohtani", "LAD", 2001, 660271, position="DH",
        )
        p_pitcher = await _create_player(
            db_session, "Shohei", "Ohtani", "LAD", 2002, 660271, position="SP",
        )

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(660271, "Shohei Ohtani", "D60")],
                109: [],
            },
            transaction_responses={
                660271: _make_transaction_response(
                    660271, "2026-03-20",
                    "Los Angeles Dodgers placed on the 60-day injured list",
                ),
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["players_added_to_il"] == 2  # Both entries

        await db_session.refresh(p_hitter)
        await db_session.refresh(p_pitcher)
        assert p_hitter.il_type == "60-Day IL"
        assert p_pitcher.il_type == "60-Day IL"
        assert p_hitter.il_date == date(2026, 3, 20)
        assert p_pitcher.il_date == date(2026, 3, 20)

    @pytest.mark.asyncio
    async def test_non_scoresheet_player_ignored(self, db_session):
        """IL player without scoresheet_id is not updated."""
        # PECOTA-only player (no scoresheet_id)
        pecota = Player(
            first_name="PECOTA", last_name="Only",
            mlb_id=999999, scoresheet_id=None,
            primary_position="OF", is_trade_bait=False,
        )
        db_session.add(pecota)
        await db_session.commit()

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(999999, "PECOTA Only", "D10")],
                109: [],
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["scoresheet_matches"] == 0
        assert summary["players_added_to_il"] == 0

    @pytest.mark.asyncio
    async def test_team_fetch_failure_continues(self, db_session):
        """One team 500 → other teams still processed."""
        player = await _create_player(db_session, "Test", "Player", "TST", 1003, 111111)

        mock = ILMockHttpClient(
            roster_responses={
                109: [_make_roster_entry(111111, "Test Player", "D15")],
            },
            team_errors={
                108: httpx.HTTPStatusError(
                    "500",
                    request=httpx.Request("GET", "http://test"),
                    response=httpx.Response(500),
                ),
            },
            transaction_responses={
                111111: _make_transaction_response(
                    111111, "2026-05-01",
                    "Placed on 15-day injured list",
                ),
            },
        )

        with _patch_httpx(mock), _patch_team_ids(), \
                patch("app.services.il_status.asyncio.sleep", return_value=None):
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["teams_failed"] == 1
        assert summary["teams_fetched"] == 1
        assert summary["scoresheet_matches"] == 1

        await db_session.refresh(player)
        assert player.il_type == "15-Day IL"

    @pytest.mark.asyncio
    async def test_all_teams_fail_preserves_existing_il(self, db_session, caplog):
        """All team fetches fail → existing IL data NOT cleared."""
        player = await _create_player(
            db_session, "Injured", "Player", "TST", 1004, 222222,
            il_type="10-Day IL", il_date=date(2026, 3, 1),
        )

        mock = ILMockHttpClient(
            team_errors={
                108: httpx.ConnectError("Connection refused"),
                109: httpx.ConnectError("Connection refused"),
            },
        )

        with _patch_httpx(mock), _patch_team_ids(), \
                patch("app.services.il_status.asyncio.sleep", return_value=None):
            with caplog.at_level(logging.WARNING, logger="app.services.il_status"):
                summary = await fetch_and_persist_il_status(db_session)

        assert summary["teams_fetched"] == 0
        assert summary["teams_failed"] == 2
        assert summary["players_cleared_from_il"] == 0

        await db_session.refresh(player)
        assert player.il_type == "10-Day IL"
        assert player.il_date == date(2026, 3, 1)

        assert any(
            "All" in r.message and "preserving existing IL data" in r.message
            for r in caplog.records
        )

    @pytest.mark.asyncio
    async def test_transaction_fetch_failure_sets_type_without_date(self, db_session):
        """Transaction fetch fails → il_type set but il_date is None."""
        player = await _create_player(db_session, "Bad", "Txn", "TST", 1005, 333333)

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(333333, "Bad Txn", "D10")],
                109: [],
            },
            transaction_errors={
                333333: httpx.ConnectError("Connection refused"),
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["scoresheet_matches"] == 1

        await db_session.refresh(player)
        assert player.il_type == "10-Day IL"
        assert player.il_date is None

    @pytest.mark.asyncio
    async def test_retry_on_server_error(self, db_session):
        """500 on first try, success on retry."""
        player = await _create_player(db_session, "Retry", "Test", "TST", 1006, 444444)

        call_count = {"count": 0}

        def conditional_error(request_num):
            """Fail first call, succeed on second."""
            if request_num == 1:
                return httpx.HTTPStatusError(
                    "500",
                    request=httpx.Request("GET", "http://test"),
                    response=httpx.Response(500),
                )
            return None  # Success path

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(444444, "Retry Test", "D10")],
                109: [],
            },
            team_errors={108: conditional_error},
            transaction_responses={
                444444: _make_transaction_response(
                    444444, "2026-07-01",
                    "Placed on 10-day injured list",
                ),
            },
        )

        with _patch_httpx(mock), _patch_team_ids(), \
                patch("app.services.il_status.asyncio.sleep", return_value=None):
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["teams_fetched"] == 2
        assert summary["scoresheet_matches"] == 1

        await db_session.refresh(player)
        assert player.il_type == "10-Day IL"

    @pytest.mark.asyncio
    async def test_no_il_players_clears_existing(self, db_session):
        """All rosters have only active players → existing IL cleared."""
        player = await _create_player(
            db_session, "Was", "Injured", "TST", 1007, 555555,
            il_type="10-Day IL", il_date=date(2026, 2, 1),
        )

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(555555, "Was Injured", "A", "Active")],
                109: [],
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        assert summary["players_cleared_from_il"] == 1

        await db_session.refresh(player)
        assert player.il_type is None
        assert player.il_date is None

    @pytest.mark.asyncio
    async def test_il_type_updated_when_changed(self, db_session):
        """Player transferred from 10-Day to 60-Day IL → type updated."""
        player = await _create_player(
            db_session, "Transfer", "Player", "TST", 1008, 666666,
            il_type="10-Day IL", il_date=date(2026, 4, 1),
        )

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(666666, "Transfer Player", "D60")],
                109: [],
            },
            transaction_responses={
                666666: _make_transaction_response(
                    666666, "2026-05-15",
                    "Transferred to the 60-day injured list",
                ),
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            summary = await fetch_and_persist_il_status(db_session)

        await db_session.refresh(player)
        assert player.il_type == "60-Day IL"
        assert player.il_date == date(2026, 5, 15)

    @pytest.mark.asyncio
    async def test_log_messages(self, db_session, caplog):
        """Info and warning logs are emitted correctly."""
        await _create_player(db_session, "Log", "Test", "TST", 1009, 777777)

        mock = ILMockHttpClient(
            roster_responses={
                108: [_make_roster_entry(777777, "Log Test", "D10")],
                109: [],
            },
            transaction_responses={
                777777: _make_transaction_response(
                    777777, "2026-06-01",
                    "Placed on 10-day injured list",
                ),
            },
        )

        with _patch_httpx(mock), _patch_team_ids():
            with caplog.at_level(logging.INFO, logger="app.services.il_status"):
                await fetch_and_persist_il_status(db_session)

        # Should have "Found X IL players" info log
        assert any("Found" in r.message and "IL players" in r.message for r in caplog.records)
        # Should have summary log
        assert any("IL status update summary" in r.message for r in caplog.records)
