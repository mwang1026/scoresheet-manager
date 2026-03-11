"""
Unit tests for MLB Stats API service (boxscore-based pipeline).

Tests parsing logic, field mappings, aggregation, and URL construction.
Uses inline mock API responses - no network calls.
"""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.services.mlb_stats_api import (
    aggregate_stats_by_player_date,
    build_boxscore_url,
    build_schedule_url,
    fetch_boxscore,
    fetch_schedule,
    parse_boxscore,
)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


def _make_boxscore_player(
    mlb_id, batting=None, pitching=None, position="LF", full_name="Test Player"
):
    """Build a mock boxscore player entry."""
    return {
        "person": {"id": mlb_id, "fullName": full_name},
        "position": {"abbreviation": position},
        "stats": {
            "batting": batting or {},
            "pitching": pitching or {},
        },
    }


def _make_batting_stats(**overrides):
    """Build batting stats with sensible defaults."""
    defaults = {
        "gamesPlayed": 1,
        "plateAppearances": 4,
        "atBats": 3,
        "hits": 1,
        "doubles": 0,
        "triples": 0,
        "homeRuns": 0,
        "totalBases": 1,
        "runs": 0,
        "rbi": 0,
        "strikeOuts": 1,
        "groundOuts": 1,
        "flyOuts": 0,
        "airOuts": 0,
        "groundIntoDoublePlay": 0,
        "baseOnBalls": 1,
        "intentionalWalks": 0,
        "hitByPitch": 0,
        "stolenBases": 0,
        "caughtStealing": 0,
        "sacFlies": 0,
        "sacBunts": 0,
        "leftOnBase": 1,
    }
    defaults.update(overrides)
    return defaults


def _make_pitching_stats(**overrides):
    """Build pitching stats with sensible defaults."""
    defaults = {
        "gamesPlayed": 1,
        "gamesStarted": 0,
        "gamesFinished": 0,
        "completeGames": 0,
        "shutouts": 0,
        "saves": 0,
        "saveOpportunities": 0,
        "blownSaves": 0,
        "holds": 0,
        "outs": 3,
        "wins": 0,
        "losses": 0,
        "earnedRuns": 0,
        "runs": 0,
        "battersFaced": 3,
        "atBats": 3,
        "hits": 0,
        "doubles": 0,
        "triples": 0,
        "homeRuns": 0,
        "totalBases": 0,
        "baseOnBalls": 0,
        "intentionalWalks": 0,
        "hitByPitch": 0,
        "strikeOuts": 1,
        "groundOuts": 1,
        "flyOuts": 1,
        "airOuts": 1,
        "stolenBases": 0,
        "caughtStealing": 0,
        "sacFlies": 0,
        "sacBunts": 0,
        "wildPitches": 0,
        "balks": 0,
        "pickoffs": 0,
        "inheritedRunners": 0,
        "inheritedRunnersScored": 0,
        "numberOfPitches": 15,
        "strikes": 10,
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# URL Building
# ---------------------------------------------------------------------------


class TestURLBuilding:
    """Tests for URL construction."""

    def test_build_schedule_url(self):
        """Test schedule URL with YYYY-MM-DD → MM/DD/YYYY conversion."""
        url = build_schedule_url("2025-09-15")

        assert "schedule" in url
        assert "sportId=1" in url
        assert "gameType=R" in url
        assert "date=09/15/2025" in url

    def test_build_boxscore_url(self):
        """Test boxscore URL construction with game PK."""
        url = build_boxscore_url(745678)

        assert "/game/745678/boxscore" in url


# ---------------------------------------------------------------------------
# fetch_schedule
# ---------------------------------------------------------------------------


class TestFetchSchedule:
    """Tests for fetch_schedule."""

    async def test_typical_day(self):
        """Test fetching a typical day with multiple final games."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "dates": [
                {
                    "date": "2025-09-15",
                    "games": [
                        {"gamePk": 100, "status": {"abstractGameState": "Final"}},
                        {"gamePk": 101, "status": {"abstractGameState": "Final"}},
                        {"gamePk": 102, "status": {"abstractGameState": "Final"}},
                    ],
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()

        client = AsyncMock()
        client.get = AsyncMock(return_value=mock_response)

        result = await fetch_schedule(client, "2025-09-15")
        assert result == [100, 101, 102]

    async def test_off_day(self):
        """Test off-day with no games returns empty list."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"dates": []}
        mock_response.raise_for_status = MagicMock()

        client = AsyncMock()
        client.get = AsyncMock(return_value=mock_response)

        result = await fetch_schedule(client, "2025-12-25")
        assert result == []

    async def test_filters_non_final_games(self):
        """Test that postponed/in-progress games are filtered out."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "dates": [
                {
                    "date": "2025-09-15",
                    "games": [
                        {"gamePk": 100, "status": {"abstractGameState": "Final"}},
                        {"gamePk": 101, "status": {"abstractGameState": "Postponed"}},
                        {"gamePk": 102, "status": {"abstractGameState": "Live"}},
                        {"gamePk": 103, "status": {"abstractGameState": "Final"}},
                    ],
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()

        client = AsyncMock()
        client.get = AsyncMock(return_value=mock_response)

        result = await fetch_schedule(client, "2025-09-15")
        assert result == [100, 103]

    async def test_http_error_returns_empty(self, caplog):
        """Test HTTP error returns empty list and logs warning."""
        client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 500
        client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Server error", request=MagicMock(), response=mock_response
            )
        )

        result = await fetch_schedule(client, "2025-09-15")
        assert result == []
        assert "HTTP error fetching schedule" in caplog.text

    async def test_request_error_returns_empty(self, caplog):
        """Test request error returns empty list and logs warning."""
        client = AsyncMock()
        client.get = AsyncMock(side_effect=httpx.RequestError("Timeout"))

        result = await fetch_schedule(client, "2025-09-15")
        assert result == []
        assert "Request error fetching schedule" in caplog.text

    async def test_schedule_url_filters_regular_season_only(self):
        """Test that fetch_schedule requests only regular season games (gameType=R)."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"dates": []}
        mock_response.raise_for_status = MagicMock()

        client = AsyncMock()
        client.get = AsyncMock(return_value=mock_response)

        await fetch_schedule(client, "2025-04-01")

        called_url = client.get.call_args[0][0]
        assert "gameType=R" in called_url


# ---------------------------------------------------------------------------
# fetch_boxscore
# ---------------------------------------------------------------------------


class TestFetchBoxscore:
    """Tests for fetch_boxscore."""

    async def test_success(self):
        """Test successful boxscore fetch returns JSON."""
        expected = {"teams": {"away": {}, "home": {}}}
        mock_response = MagicMock()
        mock_response.json.return_value = expected
        mock_response.raise_for_status = MagicMock()

        client = AsyncMock()
        client.get = AsyncMock(return_value=mock_response)

        result = await fetch_boxscore(client, 745678)
        assert result == expected

    async def test_404_returns_none(self):
        """Test 404 returns None (debug log only, no warning)."""
        client = AsyncMock()
        mock_response = MagicMock()
        mock_response.status_code = 404
        client.get = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Not found", request=MagicMock(), response=mock_response
            )
        )

        result = await fetch_boxscore(client, 999)
        assert result is None

    async def test_timeout_returns_none(self, caplog):
        """Test timeout returns None and logs warning."""
        client = AsyncMock()
        client.get = AsyncMock(side_effect=httpx.RequestError("Timeout"))

        result = await fetch_boxscore(client, 745678)
        assert result is None
        assert "Request error fetching boxscore" in caplog.text


# ---------------------------------------------------------------------------
# parse_boxscore
# ---------------------------------------------------------------------------


class TestParseBoxscore:
    """Tests for parse_boxscore."""

    def test_hitter_field_mapping(self):
        """Test all hitter fields are correctly mapped from API response."""
        batting = _make_batting_stats(
            plateAppearances=5,
            atBats=4,
            hits=3,
            doubles=1,
            triples=0,
            homeRuns=1,
            totalBases=6,
            runs=2,
            rbi=3,
            strikeOuts=1,
            groundOuts=0,
            flyOuts=1,
            airOuts=1,
            baseOnBalls=1,
            stolenBases=1,
            leftOnBase=2,
        )
        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID660271": _make_boxscore_player(
                            660271, batting=batting, full_name="Ronald Acuna Jr."
                        )
                    }
                },
                "home": {"players": {}},
            }
        }
        lookup = {660271: {"hitter": 123}}

        hitter_stats, pitcher_stats, unknowns = parse_boxscore(
            boxscore, "2025-09-15", lookup
        )

        assert len(hitter_stats) == 1
        assert len(pitcher_stats) == 0
        assert len(unknowns) == 0

        row = hitter_stats[0]
        assert row["player_id"] == 123
        assert row["date"] == "2025-09-15"
        assert row["pa"] == 5
        assert row["ab"] == 4
        assert row["h"] == 3
        assert row["double"] == 1
        assert row["hr"] == 1
        assert row["bb"] == 1
        assert row["so"] == 1
        assert row["r"] == 2
        assert row["rbi"] == 3
        assert row["sb"] == 1
        assert row["lob"] == 2

    def test_singles_derivation(self):
        """Test singles = h - 2b - 3b - hr."""
        batting = _make_batting_stats(hits=4, doubles=1, triples=1, homeRuns=1)
        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID100": _make_boxscore_player(100, batting=batting)
                    }
                },
                "home": {"players": {}},
            }
        }
        lookup = {100: {"hitter": 1}}

        hitter_stats, _, _ = parse_boxscore(boxscore, "2025-09-10", lookup)

        assert hitter_stats[0]["single"] == 1  # 4 - 1 - 1 - 1

    def test_pitcher_field_mapping(self):
        """Test all pitcher fields are correctly mapped from API response."""
        pitching = _make_pitching_stats(
            gamesPlayed=1,
            gamesStarted=1,
            outs=21,
            wins=1,
            earnedRuns=2,
            runs=2,
            battersFaced=28,
            atBats=25,
            hits=5,
            doubles=1,
            homeRuns=1,
            totalBases=8,
            baseOnBalls=2,
            hitByPitch=1,
            strikeOuts=8,
            groundOuts=7,
            flyOuts=5,
            airOuts=5,
            wildPitches=1,
            numberOfPitches=105,
            strikes=70,
        )
        boxscore = {
            "teams": {
                "away": {"players": {}},
                "home": {
                    "players": {
                        "ID500": _make_boxscore_player(
                            500,
                            pitching=pitching,
                            position="P",
                            full_name="Ace Pitcher",
                        )
                    }
                },
            }
        }
        lookup = {500: {"pitcher": 555}}

        _, pitcher_stats, _ = parse_boxscore(boxscore, "2025-09-12", lookup)

        assert len(pitcher_stats) == 1
        row = pitcher_stats[0]
        assert row["player_id"] == 555
        assert row["g"] == 1
        assert row["gs"] == 1
        assert row["ip_outs"] == 21
        assert row["w"] == 1
        assert row["er"] == 2
        assert row["bf"] == 28
        assert row["h"] == 5
        assert row["bb"] == 2
        assert row["k"] == 8
        assert row["hr"] == 1
        assert row["wp"] == 1
        assert row["pitches"] == 105
        assert row["strikes"] == 70

    def test_two_way_player_routing(self):
        """Test two-way player routes batting to hitter, pitching to pitcher persona."""
        batting = _make_batting_stats(plateAppearances=3, hits=1)
        pitching = _make_pitching_stats(outs=6, strikeOuts=3)

        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID660271": _make_boxscore_player(
                            660271,
                            batting=batting,
                            pitching=pitching,
                            position="P",
                            full_name="Shohei Ohtani",
                        ),
                    }
                },
                "home": {"players": {}},
            }
        }
        lookup = {660271: {"hitter": 10, "pitcher": 11}}

        hitter_stats, pitcher_stats, _ = parse_boxscore(
            boxscore, "2025-09-15", lookup
        )

        # Batting → hitter persona
        assert len(hitter_stats) == 1
        assert hitter_stats[0]["player_id"] == 10

        # Pitching → pitcher persona
        assert len(pitcher_stats) == 1
        assert pitcher_stats[0]["player_id"] == 11

    def test_unknown_player_collection(self):
        """Test unknown players are collected with info from boxscore."""
        batting = _make_batting_stats(plateAppearances=3)
        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID999999": _make_boxscore_player(
                            999999,
                            batting=batting,
                            position="CF",
                            full_name="Mystery Player",
                        ),
                    }
                },
                "home": {"players": {}},
            }
        }
        lookup = {}  # Empty — player not in DB

        hitter_stats, _, unknowns = parse_boxscore(boxscore, "2025-09-15", lookup)

        assert len(hitter_stats) == 1
        assert "_mlb_id" in hitter_stats[0]
        assert hitter_stats[0]["_mlb_id"] == 999999
        assert "player_id" not in hitter_stats[0]

        assert 999999 in unknowns
        assert unknowns[999999]["first_name"] == "Mystery"
        assert unknowns[999999]["last_name"] == "Player"
        assert unknowns[999999]["position"] == "CF"

    def test_pitcher_batting_fallback(self):
        """Test pitcher who bats falls back to pitcher persona for batting stats."""
        batting = _make_batting_stats(plateAppearances=2, hits=0)
        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID500": _make_boxscore_player(
                            500, batting=batting, position="P"
                        ),
                    }
                },
                "home": {"players": {}},
            }
        }
        # Only pitcher entry — batting should fallback
        lookup = {500: {"pitcher": 55}}

        hitter_stats, _, _ = parse_boxscore(boxscore, "2025-09-15", lookup)
        assert len(hitter_stats) == 1
        assert hitter_stats[0]["player_id"] == 55

    def test_position_player_pitching_fallback(self):
        """Test position player who pitches falls back to hitter persona."""
        pitching = _make_pitching_stats(outs=3, battersFaced=4)
        boxscore = {
            "teams": {
                "away": {"players": {}},
                "home": {
                    "players": {
                        "ID200": _make_boxscore_player(
                            200, pitching=pitching, position="OF"
                        ),
                    }
                },
            }
        }
        # Only hitter entry — pitching should fallback
        lookup = {200: {"hitter": 20}}

        _, pitcher_stats, _ = parse_boxscore(boxscore, "2025-09-15", lookup)
        assert len(pitcher_stats) == 1
        assert pitcher_stats[0]["player_id"] == 20

    def test_bench_player_no_pa_skipped(self):
        """Test bench player with 0 PA is not included in hitter stats."""
        batting = _make_batting_stats(plateAppearances=0)
        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID300": _make_boxscore_player(300, batting=batting),
                    }
                },
                "home": {"players": {}},
            }
        }
        lookup = {300: {"hitter": 30}}

        hitter_stats, _, _ = parse_boxscore(boxscore, "2025-09-15", lookup)
        assert len(hitter_stats) == 0

    def test_pitcher_no_outs_no_bf_skipped(self):
        """Test pitcher with 0 outs and 0 BF is not included."""
        pitching = _make_pitching_stats(outs=0, battersFaced=0)
        boxscore = {
            "teams": {
                "away": {"players": {}},
                "home": {
                    "players": {
                        "ID400": _make_boxscore_player(
                            400, pitching=pitching, position="P"
                        ),
                    }
                },
            }
        }
        lookup = {400: {"pitcher": 40}}

        _, pitcher_stats, _ = parse_boxscore(boxscore, "2025-09-15", lookup)
        assert len(pitcher_stats) == 0

    def test_both_teams_parsed(self):
        """Test players from both away and home teams are included."""
        batting_away = _make_batting_stats(plateAppearances=4, hits=2)
        batting_home = _make_batting_stats(plateAppearances=3, hits=1)
        boxscore = {
            "teams": {
                "away": {
                    "players": {
                        "ID100": _make_boxscore_player(100, batting=batting_away)
                    }
                },
                "home": {
                    "players": {
                        "ID200": _make_boxscore_player(200, batting=batting_home)
                    }
                },
            }
        }
        lookup = {100: {"hitter": 1}, 200: {"hitter": 2}}

        hitter_stats, _, _ = parse_boxscore(boxscore, "2025-09-15", lookup)

        assert len(hitter_stats) == 2
        player_ids = {s["player_id"] for s in hitter_stats}
        assert player_ids == {1, 2}

    def test_empty_boxscore(self):
        """Test empty/malformed boxscore returns empty lists."""
        hitter, pitcher, unknown = parse_boxscore({}, "2025-09-15", {})
        assert hitter == []
        assert pitcher == []
        assert unknown == {}

    def test_invalid_player_key_skipped(self):
        """Test non-ID player keys are ignored."""
        boxscore = {
            "teams": {
                "away": {"players": {"notAnID": {}, "team": {}}},
                "home": {"players": {}},
            }
        }
        hitter, pitcher, unknown = parse_boxscore(boxscore, "2025-09-15", {})
        assert hitter == []
        assert pitcher == []


# ---------------------------------------------------------------------------
# aggregate_stats_by_player_date
# ---------------------------------------------------------------------------


class TestAggregateStats:
    """Tests for aggregate_stats_by_player_date."""

    def test_doubleheader_sums(self):
        """Test doubleheader stats are summed correctly."""
        stats = [
            {
                "player_id": 1,
                "date": "2025-09-20",
                "g": 1,
                "pa": 4,
                "h": 2,
                "double": 1,
                "triple": 0,
                "hr": 0,
                "single": 1,
            },
            {
                "player_id": 1,
                "date": "2025-09-20",
                "g": 1,
                "pa": 5,
                "h": 1,
                "double": 0,
                "triple": 0,
                "hr": 1,
                "single": 0,
            },
        ]

        result = aggregate_stats_by_player_date(stats, derive_singles=True)

        assert len(result) == 1
        row = result[0]
        assert row["g"] == 2
        assert row["pa"] == 9
        assert row["h"] == 3
        assert row["double"] == 1
        assert row["hr"] == 1
        assert row["single"] == 1  # 3 - 1 - 0 - 1 = 1 (re-derived)

    def test_no_duplicates_passthrough(self):
        """Test stats without duplicates pass through unchanged."""
        stats = [
            {"player_id": 1, "date": "2025-09-20", "g": 1, "pa": 4, "h": 2},
            {"player_id": 2, "date": "2025-09-20", "g": 1, "pa": 3, "h": 1},
        ]

        result = aggregate_stats_by_player_date(stats)
        assert len(result) == 2

    def test_empty_input(self):
        """Test empty input returns empty output."""
        assert aggregate_stats_by_player_date([]) == []

    def test_singles_rederived_after_sum(self):
        """Test singles are recalculated from aggregated totals."""
        stats = [
            {
                "player_id": 1,
                "date": "2025-09-20",
                "h": 2,
                "double": 1,
                "triple": 0,
                "hr": 0,
                "single": 1,
            },
            {
                "player_id": 1,
                "date": "2025-09-20",
                "h": 3,
                "double": 0,
                "triple": 1,
                "hr": 1,
                "single": 1,
            },
        ]

        result = aggregate_stats_by_player_date(stats, derive_singles=True)
        row = result[0]
        # h=5, double=1, triple=1, hr=1 → single = 5-1-1-1 = 2
        assert row["single"] == 2

    def test_unknown_players_grouped_by_mlb_id(self):
        """Test stats with _mlb_id are grouped separately from player_id stats."""
        stats = [
            {"_mlb_id": 999, "date": "2025-09-20", "g": 1, "h": 1},
            {"_mlb_id": 999, "date": "2025-09-20", "g": 1, "h": 2},
            {"player_id": 1, "date": "2025-09-20", "g": 1, "h": 3},
        ]

        result = aggregate_stats_by_player_date(stats)

        assert len(result) == 2
        unknown_row = next(r for r in result if "_mlb_id" in r)
        assert unknown_row["h"] == 3  # 1 + 2
        assert unknown_row["g"] == 2

    def test_different_dates_not_aggregated(self):
        """Test same player on different dates stays separate."""
        stats = [
            {"player_id": 1, "date": "2025-09-20", "g": 1, "h": 2},
            {"player_id": 1, "date": "2025-09-21", "g": 1, "h": 1},
        ]

        result = aggregate_stats_by_player_date(stats)
        assert len(result) == 2
