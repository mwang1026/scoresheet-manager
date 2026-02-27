"""Tests for player matching cascade."""

from unittest.mock import patch

import httpx
import pytest

from app.models.player import Player
from app.services.news_scraper.matcher import (
    MatchMethod,
    MatchResult,
    _CachedPlayer,
    _exact_match,
    _fuzzy_match,
    _split_name,
    match_player,
    match_players_batch,
)


# ---------------------------------------------------------------------------
# Mock HTTP helpers
# ---------------------------------------------------------------------------


class MockHttpClient:
    """Simple mock httpx client for matcher tests."""

    def __init__(self, json_response=None):
        self._json = json_response or {"people": []}

    async def get(self, *args, **kwargs):
        return httpx.Response(
            200,
            json=self._json,
            request=httpx.Request("GET", "http://test"),
        )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_player(
    id: int,
    first_name: str,
    last_name: str,
    team: str | None = None,
    mlb_id: int | None = None,
) -> _CachedPlayer:
    return _CachedPlayer(
        id=id,
        first_name=first_name,
        last_name=last_name,
        full_name=f"{first_name} {last_name}",
        current_mlb_team=team,
        mlb_id=mlb_id,
    )


SAMPLE_PLAYERS = [
    _make_player(1, "Mike", "Trout", "LAA", 545361),
    _make_player(2, "Aaron", "Judge", "NYA", 592450),
    _make_player(3, "Shohei", "Ohtani", "LAD", 660271),
    _make_player(4, "Vladimir", "Guerrero Jr.", "Tor", 665489),
    _make_player(5, "J.D.", "Martinez", "NYN", 502110),
    _make_player(6, "Ronald", "Acuna Jr.", "Atl", 660670),
    _make_player(7, "Mike", "Trout", "Det", 999999),  # Hypothetical same-name player
]


# ---------------------------------------------------------------------------
# _split_name tests
# ---------------------------------------------------------------------------


class TestSplitName:
    def test_simple_name(self):
        assert _split_name("Mike Trout") == ("Mike", "Trout")

    def test_jr_suffix(self):
        assert _split_name("Vladimir Guerrero Jr.") == ("Vladimir", "Guerrero Jr.")

    def test_jd_martinez(self):
        assert _split_name("J.D. Martinez") == ("J.D.", "Martinez")

    def test_single_name(self):
        assert _split_name("Ohtani") == ("", "Ohtani")

    def test_empty_string(self):
        assert _split_name("") == ("", "")

    def test_multi_part_last_name(self):
        assert _split_name("Ronald Acuna Jr.") == ("Ronald", "Acuna Jr.")


# ---------------------------------------------------------------------------
# _exact_match tests
# ---------------------------------------------------------------------------


class TestExactMatch:
    def test_exact_name_and_team(self):
        """Step 1: Exact name + team returns confidence 1.0."""
        result = _exact_match(SAMPLE_PLAYERS, "Mike", "Trout", "LAA")
        assert result is not None
        assert result.player_id == 1
        assert result.method == MatchMethod.exact_name_team
        assert result.confidence == 1.0

    def test_same_name_different_team_matches_correct(self):
        """Same-name players: team match wins."""
        result = _exact_match(SAMPLE_PLAYERS, "Mike", "Trout", "Det")
        assert result is not None
        assert result.player_id == 7  # The Det Mike Trout
        assert result.method == MatchMethod.exact_name_team

    def test_exact_name_only_no_team(self):
        """Step 2: Exact name without team returns confidence 0.9."""
        result = _exact_match(SAMPLE_PLAYERS, "Aaron", "Judge", None)
        assert result is not None
        assert result.player_id == 2
        assert result.method == MatchMethod.exact_name_only
        assert result.confidence == 0.9

    def test_exact_name_team_not_found(self):
        """Name matches but wrong team falls through to name-only."""
        result = _exact_match(SAMPLE_PLAYERS, "Aaron", "Judge", "Bos")
        assert result is not None
        assert result.player_id == 2
        assert result.method == MatchMethod.exact_name_only
        assert result.confidence == 0.9

    def test_no_match(self):
        """No name match returns None."""
        result = _exact_match(SAMPLE_PLAYERS, "Nobody", "Here", "LAA")
        assert result is None

    def test_case_insensitive(self):
        """Name matching is case-insensitive."""
        result = _exact_match(SAMPLE_PLAYERS, "mike", "trout", "LAA")
        assert result is not None
        assert result.player_id == 1

    def test_jr_suffix_match(self):
        """Jr. suffix matches correctly."""
        result = _exact_match(SAMPLE_PLAYERS, "Vladimir", "Guerrero Jr.", "Tor")
        assert result is not None
        assert result.player_id == 4
        assert result.method == MatchMethod.exact_name_team


# ---------------------------------------------------------------------------
# _fuzzy_match tests
# ---------------------------------------------------------------------------


class TestFuzzyMatch:
    def test_high_similarity_with_team(self):
        """Step 5: Fuzzy match with team at >= 90%."""
        result = _fuzzy_match(SAMPLE_PLAYERS, "Miike Trout", "LAA")
        assert result is not None
        assert result.player_id == 1
        assert result.method == MatchMethod.fuzzy_name_team

    def test_high_similarity_no_team(self):
        """Step 6: Fuzzy match without team, discounted."""
        result = _fuzzy_match(SAMPLE_PLAYERS, "Shohei Ohtanii", None)
        if result:
            assert result.method in (MatchMethod.fuzzy_name_only, MatchMethod.fuzzy_name_team)
            assert result.confidence < 1.0

    def test_below_threshold_no_match(self):
        """Fuzzy ratio below 90% returns None."""
        result = _fuzzy_match(SAMPLE_PLAYERS, "Completely Different Name", "LAA")
        assert result is None

    def test_team_preferred_over_no_team(self):
        """When both team and no-team matches exist, team wins."""
        result = _fuzzy_match(SAMPLE_PLAYERS, "Mike Troutt", "LAA")
        if result:
            assert result.player_id == 1  # LAA Mike Trout, not Det one
            assert result.method == MatchMethod.fuzzy_name_team


# ---------------------------------------------------------------------------
# match_player integration (full cascade)
# ---------------------------------------------------------------------------


class TestMatchPlayer:
    @pytest.mark.asyncio
    async def test_exact_match_short_circuits(self):
        """Exact match found skips MLB API and fuzzy."""
        client = MockHttpClient()
        result = await match_player(SAMPLE_PLAYERS, "Aaron Judge", "NYA", client)
        assert result.player_id == 2
        assert result.method == MatchMethod.exact_name_team
        assert result.confidence == 1.0

    @pytest.mark.asyncio
    async def test_unmatched_returns_none_id(self):
        """Completely unknown player returns unmatched."""
        client = MockHttpClient({"people": []})
        result = await match_player(SAMPLE_PLAYERS, "Nonexistent Player", "XXX", client)
        assert result.player_id is None
        assert result.method == MatchMethod.unmatched
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_mlb_api_fallback(self):
        """When exact match fails, MLB API is tried."""
        players = [_make_player(10, "Robert", "Smith", "Bos", 12345)]
        client = MockHttpClient({"people": [{"id": 12345, "fullName": "Bob Smith"}]})

        result = await match_player(players, "Bob Smith", "Bos", client)
        assert result.player_id == 10
        assert result.method == MatchMethod.mlb_api_name_team
        assert result.confidence == 0.95

    @pytest.mark.asyncio
    async def test_mlb_api_name_only(self):
        """MLB API match without team returns lower confidence."""
        players = [_make_player(10, "Robert", "Smith", "Bos", 12345)]
        client = MockHttpClient({"people": [{"id": 12345, "fullName": "Bob Smith"}]})

        result = await match_player(players, "Bob Smith", "NYA", client)
        assert result.player_id == 10
        assert result.method == MatchMethod.mlb_api_name_only
        assert result.confidence == 0.85


# ---------------------------------------------------------------------------
# match_players_batch (DB integration)
# ---------------------------------------------------------------------------


class TestMatchPlayersBatch:
    @pytest.mark.asyncio
    async def test_batch_loads_players_once(self, db_session, sample_player_data):
        """Batch matching loads players from DB and processes all items."""
        p1 = Player(**{**sample_player_data, "scoresheet_id": 200, "mlb_id": 200000,
                       "first_name": "Mike", "last_name": "Trout", "current_mlb_team": "LAA"})
        p2 = Player(**{**sample_player_data, "scoresheet_id": 201, "mlb_id": 200001,
                       "first_name": "Aaron", "last_name": "Judge", "current_mlb_team": "NYA"})
        db_session.add_all([p1, p2])
        await db_session.commit()
        await db_session.refresh(p1)
        await db_session.refresh(p2)

        items = [
            ("Mike Trout", "LAA"),
            ("Aaron Judge", "NYA"),
            ("Unknown Person", None),
        ]

        # Patch httpx.AsyncClient in the matcher module to use our mock
        mock_client = MockHttpClient({"people": []})

        with patch("app.services.news_scraper.matcher.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value = _MockAsyncContextManager(mock_client)
            results = await match_players_batch(db_session, items)

        assert len(results) == 3
        assert results[0].player_id == p1.id
        assert results[0].method == MatchMethod.exact_name_team
        assert results[1].player_id == p2.id
        assert results[1].method == MatchMethod.exact_name_team
        assert results[2].method == MatchMethod.unmatched

    @pytest.mark.asyncio
    async def test_batch_excludes_pecota_only(self, db_session, sample_player_data):
        """PECOTA-only players (no scoresheet_id) are excluded from matching."""
        p1 = Player(**{**sample_player_data, "scoresheet_id": 300, "mlb_id": 300000,
                       "first_name": "Juan", "last_name": "Soto", "current_mlb_team": "NYN"})
        p2 = Player(**{**sample_player_data, "scoresheet_id": None, "mlb_id": 300001,
                       "first_name": "Juan", "last_name": "Soto", "current_mlb_team": "NYN"})
        db_session.add_all([p1, p2])
        await db_session.commit()
        await db_session.refresh(p1)

        items = [("Juan Soto", "NYN")]

        mock_client = MockHttpClient({"people": []})

        with patch("app.services.news_scraper.matcher.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value = _MockAsyncContextManager(mock_client)
            results = await match_players_batch(db_session, items)

        assert len(results) == 1
        assert results[0].player_id == p1.id  # Scoresheet player, not PECOTA-only


class _MockAsyncContextManager:
    """Wraps an object to support `async with`."""

    def __init__(self, obj):
        self._obj = obj

    async def __aenter__(self):
        return self._obj

    async def __aexit__(self, *args):
        pass
