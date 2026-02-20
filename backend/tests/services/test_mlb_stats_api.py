"""
Unit tests for MLB Stats API service.

Tests parsing logic, field mappings, doubleheader aggregation, etc.
Uses inline mock API responses - no network calls.
"""

import pytest

from app.services.mlb_stats_api import (
    build_game_log_url,
    parse_hitter_game_log,
    parse_pitcher_game_log,
)


class TestURLBuilding:
    """Tests for URL construction."""

    def test_build_game_log_url(self):
        """Test correct URL construction."""
        url = build_game_log_url(
            mlb_id=660271,
            group="hitting",
            season=2025,
            start_date="09/01/2025",
            end_date="09/28/2025",
        )

        assert "https://statsapi.mlb.com/api/v1/people/660271/stats" in url
        assert "stats=gameLog" in url
        assert "season=2025" in url
        assert "group=hitting" in url
        assert "startDate=09/01/2025" in url
        assert "endDate=09/28/2025" in url


class TestHitterParsing:
    """Tests for hitter game log parsing."""

    def test_parse_hitter_game_log_typical_game(self):
        """Test parsing a typical hitter game with all fields."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-15",
                            "stat": {
                                "gamesPlayed": 1,
                                "plateAppearances": 5,
                                "atBats": 4,
                                "hits": 3,
                                "doubles": 1,
                                "triples": 0,
                                "homeRuns": 1,
                                "totalBases": 6,
                                "runs": 2,
                                "rbi": 3,
                                "strikeOuts": 1,
                                "groundOuts": 0,
                                "flyOuts": 1,
                                "airOuts": 1,
                                "groundIntoDoublePlay": 0,
                                "baseOnBalls": 1,
                                "intentionalWalks": 0,
                                "hitByPitch": 0,
                                "stolenBases": 1,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "leftOnBase": 2,
                                "numberOfPitches": 22,
                            },
                        }
                    ]
                }
            ]
        }

        result = parse_hitter_game_log(api_response, player_id=123)

        assert len(result) == 1
        game = result[0]

        # Check core fields
        assert game["player_id"] == 123
        assert game["date"] == "2025-09-15"
        assert game["pa"] == 5
        assert game["ab"] == 4
        assert game["h"] == 3
        assert game["double"] == 1
        assert game["triple"] == 0
        assert game["hr"] == 1
        assert game["single"] == 1  # h - 2b - 3b - hr = 3 - 1 - 0 - 1 = 1
        assert game["bb"] == 1
        assert game["so"] == 1
        assert game["r"] == 2
        assert game["rbi"] == 3
        assert game["sb"] == 1

    def test_parse_hitter_singles_derivation(self):
        """Test singles are correctly derived (single = h - 2b - 3b - hr)."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-10",
                            "stat": {
                                "gamesPlayed": 1,
                                "plateAppearances": 4,
                                "atBats": 4,
                                "hits": 4,
                                "doubles": 1,
                                "triples": 1,
                                "homeRuns": 1,
                                "totalBases": 9,
                                "runs": 3,
                                "rbi": 4,
                                "strikeOuts": 0,
                                "groundOuts": 0,
                                "flyOuts": 0,
                                "airOuts": 0,
                                "groundIntoDoublePlay": 0,
                                "baseOnBalls": 0,
                                "intentionalWalks": 0,
                                "hitByPitch": 0,
                                "stolenBases": 0,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "leftOnBase": 0,
                                "numberOfPitches": 15,
                            },
                        }
                    ]
                }
            ]
        }

        result = parse_hitter_game_log(api_response, player_id=456)

        assert len(result) == 1
        game = result[0]

        # 4 hits = 1 single + 1 double + 1 triple + 1 HR
        assert game["h"] == 4
        assert game["double"] == 1
        assert game["triple"] == 1
        assert game["hr"] == 1
        assert game["single"] == 1  # 4 - 1 - 1 - 1 = 1

    def test_parse_empty_splits(self):
        """Test parsing response with no game splits (no games in range)."""
        api_response = {"stats": [{"splits": []}]}

        result = parse_hitter_game_log(api_response, player_id=789)

        assert result == []

    def test_parse_doubleheader_aggregation(self):
        """Test doubleheader games on same date are aggregated."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-20",
                            "stat": {
                                "gamesPlayed": 1,
                                "plateAppearances": 4,
                                "atBats": 3,
                                "hits": 2,
                                "doubles": 1,
                                "triples": 0,
                                "homeRuns": 0,
                                "totalBases": 3,
                                "runs": 1,
                                "rbi": 1,
                                "strikeOuts": 1,
                                "groundOuts": 0,
                                "flyOuts": 1,
                                "airOuts": 1,
                                "groundIntoDoublePlay": 0,
                                "baseOnBalls": 1,
                                "intentionalWalks": 0,
                                "hitByPitch": 0,
                                "stolenBases": 0,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "leftOnBase": 1,
                                "numberOfPitches": 18,
                            },
                        },
                        {
                            # Same date - second game of doubleheader
                            "date": "2025-09-20",
                            "stat": {
                                "gamesPlayed": 1,
                                "plateAppearances": 5,
                                "atBats": 5,
                                "hits": 1,
                                "doubles": 0,
                                "triples": 0,
                                "homeRuns": 1,
                                "totalBases": 4,
                                "runs": 1,
                                "rbi": 2,
                                "strikeOuts": 2,
                                "groundOuts": 1,
                                "flyOuts": 1,
                                "airOuts": 1,
                                "groundIntoDoublePlay": 0,
                                "baseOnBalls": 0,
                                "intentionalWalks": 0,
                                "hitByPitch": 0,
                                "stolenBases": 1,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "leftOnBase": 2,
                                "numberOfPitches": 20,
                            },
                        },
                    ]
                }
            ]
        }

        result = parse_hitter_game_log(api_response, player_id=321)

        # Should combine into single row for 2025-09-20
        assert len(result) == 1
        game = result[0]

        assert game["date"] == "2025-09-20"
        # Aggregated stats (game1 + game2)
        assert game["g"] == 2  # 1 + 1
        assert game["pa"] == 9  # 4 + 5
        assert game["ab"] == 8  # 3 + 5
        assert game["h"] == 3  # 2 + 1
        assert game["double"] == 1  # 1 + 0
        assert game["hr"] == 1  # 0 + 1
        assert game["single"] == 1  # (3 total hits - 1 double - 1 HR)
        assert game["bb"] == 1  # 1 + 0
        assert game["so"] == 3  # 1 + 2
        assert game["sb"] == 1  # 0 + 1

    def test_parse_malformed_response(self):
        """Test parsing handles malformed API responses gracefully."""
        # Missing 'stats' key
        assert parse_hitter_game_log({}, player_id=999) == []

        # Empty stats array
        assert parse_hitter_game_log({"stats": []}, player_id=999) == []

        # Stats without splits
        assert parse_hitter_game_log({"stats": [{}]}, player_id=999) == []


class TestPitcherParsing:
    """Tests for pitcher game log parsing."""

    def test_parse_pitcher_game_log_starter(self):
        """Test parsing a starting pitcher appearance."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-12",
                            "stat": {
                                "gamesPlayed": 1,
                                "gamesStarted": 1,
                                "gamesFinished": 0,
                                "completeGames": 0,
                                "shutouts": 0,
                                "saves": 0,
                                "saveOpportunities": 0,
                                "blownSaves": 0,
                                "holds": 0,
                                "outs": 21,  # 7.0 IP
                                "wins": 1,
                                "losses": 0,
                                "earnedRuns": 2,
                                "runs": 2,
                                "battersFaced": 28,
                                "atBats": 25,
                                "hits": 5,
                                "doubles": 1,
                                "triples": 0,
                                "homeRuns": 1,
                                "totalBases": 8,
                                "baseOnBalls": 2,
                                "intentionalWalks": 0,
                                "hitByPitch": 1,
                                "strikeOuts": 8,
                                "groundOuts": 7,
                                "flyOuts": 5,
                                "airOuts": 5,
                                "stolenBases": 1,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "wildPitches": 1,
                                "balks": 0,
                                "pickoffs": 0,
                                "inheritedRunners": 0,
                                "inheritedRunnersScored": 0,
                                "numberOfPitches": 105,
                                "strikes": 70,
                            },
                        }
                    ]
                }
            ]
        }

        result = parse_pitcher_game_log(api_response, player_id=555)

        assert len(result) == 1
        game = result[0]

        # Check core fields
        assert game["player_id"] == 555
        assert game["date"] == "2025-09-12"
        assert game["g"] == 1
        assert game["gs"] == 1
        assert game["gf"] == 0
        assert game["ip_outs"] == 21  # Direct mapping from 'outs'
        assert game["w"] == 1
        assert game["l"] == 0
        assert game["er"] == 2
        assert game["bf"] == 28
        assert game["h"] == 5
        assert game["bb"] == 2
        assert game["k"] == 8
        assert game["hr"] == 1
        assert game["wp"] == 1

    def test_parse_pitcher_game_log_reliever(self):
        """Test parsing a relief pitcher appearance with save."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-18",
                            "stat": {
                                "gamesPlayed": 1,
                                "gamesStarted": 0,
                                "gamesFinished": 1,
                                "completeGames": 0,
                                "shutouts": 0,
                                "saves": 1,
                                "saveOpportunities": 1,
                                "blownSaves": 0,
                                "holds": 0,
                                "outs": 3,  # 1.0 IP
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
                                "strikeOuts": 2,
                                "groundOuts": 1,
                                "flyOuts": 0,
                                "airOuts": 0,
                                "stolenBases": 0,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "wildPitches": 0,
                                "balks": 0,
                                "pickoffs": 0,
                                "inheritedRunners": 2,
                                "inheritedRunnersScored": 0,
                                "numberOfPitches": 12,
                                "strikes": 9,
                            },
                        }
                    ]
                }
            ]
        }

        result = parse_pitcher_game_log(api_response, player_id=666)

        assert len(result) == 1
        game = result[0]

        assert game["g"] == 1
        assert game["gs"] == 0
        assert game["gf"] == 1
        assert game["sv"] == 1
        assert game["svo"] == 1
        assert game["ip_outs"] == 3
        assert game["ir"] == 2
        assert game["irs"] == 0

    def test_parse_pitcher_outs_direct(self):
        """Test that 'outs' field maps directly to 'ip_outs'."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-05",
                            "stat": {
                                "gamesPlayed": 1,
                                "gamesStarted": 1,
                                "gamesFinished": 0,
                                "completeGames": 0,
                                "shutouts": 0,
                                "saves": 0,
                                "saveOpportunities": 0,
                                "blownSaves": 0,
                                "holds": 0,
                                "outs": 16,  # 5.1 IP
                                "wins": 0,
                                "losses": 1,
                                "earnedRuns": 5,
                                "runs": 5,
                                "battersFaced": 24,
                                "atBats": 20,
                                "hits": 8,
                                "doubles": 2,
                                "triples": 0,
                                "homeRuns": 2,
                                "totalBases": 16,
                                "baseOnBalls": 3,
                                "intentionalWalks": 0,
                                "hitByPitch": 1,
                                "strikeOuts": 4,
                                "groundOuts": 5,
                                "flyOuts": 6,
                                "airOuts": 6,
                                "stolenBases": 0,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "wildPitches": 0,
                                "balks": 0,
                                "pickoffs": 0,
                                "inheritedRunners": 0,
                                "inheritedRunnersScored": 0,
                                "numberOfPitches": 88,
                                "strikes": 55,
                            },
                        }
                    ]
                }
            ]
        }

        result = parse_pitcher_game_log(api_response, player_id=777)

        assert len(result) == 1
        assert result[0]["ip_outs"] == 16  # Direct integer value

    def test_parse_pitcher_doubleheader_aggregation(self):
        """Test pitcher doubleheader games on same date are aggregated."""
        api_response = {
            "stats": [
                {
                    "splits": [
                        {
                            "date": "2025-09-25",
                            "stat": {
                                "gamesPlayed": 1,
                                "gamesStarted": 0,
                                "gamesFinished": 0,
                                "completeGames": 0,
                                "shutouts": 0,
                                "saves": 0,
                                "saveOpportunities": 0,
                                "blownSaves": 0,
                                "holds": 1,
                                "outs": 2,
                                "wins": 0,
                                "losses": 0,
                                "earnedRuns": 0,
                                "runs": 0,
                                "battersFaced": 2,
                                "atBats": 2,
                                "hits": 0,
                                "doubles": 0,
                                "triples": 0,
                                "homeRuns": 0,
                                "totalBases": 0,
                                "baseOnBalls": 0,
                                "intentionalWalks": 0,
                                "hitByPitch": 0,
                                "strikeOuts": 2,
                                "groundOuts": 0,
                                "flyOuts": 0,
                                "airOuts": 0,
                                "stolenBases": 0,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "wildPitches": 0,
                                "balks": 0,
                                "pickoffs": 0,
                                "inheritedRunners": 1,
                                "inheritedRunnersScored": 0,
                                "numberOfPitches": 8,
                                "strikes": 6,
                            },
                        },
                        {
                            "date": "2025-09-25",
                            "stat": {
                                "gamesPlayed": 1,
                                "gamesStarted": 0,
                                "gamesFinished": 1,
                                "completeGames": 0,
                                "shutouts": 0,
                                "saves": 0,
                                "saveOpportunities": 0,
                                "blownSaves": 0,
                                "holds": 0,
                                "outs": 3,
                                "wins": 1,
                                "losses": 0,
                                "earnedRuns": 0,
                                "runs": 0,
                                "battersFaced": 3,
                                "atBats": 3,
                                "hits": 1,
                                "doubles": 0,
                                "triples": 0,
                                "homeRuns": 0,
                                "totalBases": 1,
                                "baseOnBalls": 0,
                                "intentionalWalks": 0,
                                "hitByPitch": 0,
                                "strikeOuts": 1,
                                "groundOuts": 1,
                                "flyOuts": 0,
                                "airOuts": 0,
                                "stolenBases": 0,
                                "caughtStealing": 0,
                                "sacFlies": 0,
                                "sacBunts": 0,
                                "wildPitches": 0,
                                "balks": 0,
                                "pickoffs": 0,
                                "inheritedRunners": 0,
                                "inheritedRunnersScored": 0,
                                "numberOfPitches": 10,
                                "strikes": 7,
                            },
                        },
                    ]
                }
            ]
        }

        result = parse_pitcher_game_log(api_response, player_id=888)

        # Should combine into single row
        assert len(result) == 1
        game = result[0]

        assert game["date"] == "2025-09-25"
        assert game["g"] == 2  # 1 + 1
        assert game["gf"] == 1  # 0 + 1
        assert game["hld"] == 1  # 1 + 0
        assert game["ip_outs"] == 5  # 2 + 3
        assert game["w"] == 1  # 0 + 1
        assert game["k"] == 3  # 2 + 1
        assert game["h"] == 1  # 0 + 1
