"""Tests for the Score-It lineup parser.

The primary fixture is a real AG_<league>.js file captured from scoresheet.com
(week ending 2026-09-20). Expected values below were cross-checked against
the league's box score page for the same week.
"""

import logging
from datetime import date
from pathlib import Path

import pytest

from app.services.scoresheet_scraper.lineup_parser import (
    POSITION_CODES,
    STARTING_PITCHER_SLOT,
    LineupEntry,
    parse_lineup_tokens,
    parse_score_it_js,
    parse_thru_date,
)

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "al_catfish_hunter_AG.js"


@pytest.fixture(scope="module")
def real_js() -> str:
    return FIXTURE.read_text()


class TestRealFixture:
    def test_parses_all_games_and_date(self, real_js):
        parsed = parse_score_it_js(real_js)
        assert parsed.thru_date == date(2026, 9, 20)
        assert len(parsed.games) == 30
        assert [g.game_no for g in parsed.games] == list(range(30))

    def test_first_game_matches_box_score(self, real_js):
        """Game 1: BiCoastal BiValves (team 9) @ Quad A Superstars (team 1)."""
        game = parse_score_it_js(real_js).games[0]
        assert game.visitor_idx == 8
        assert game.home_idx == 0
        assert game.visitor_name == "BiCoastal BiValves"
        assert game.home_name == "Quad A Superstars"
        assert (game.visitor_score, game.home_score) == (4, 2)

        # Box score order: LF Arozarena, DH Alvarez, SS Witt, 1B Alonso, C Dingler,
        # 2B McGonigle, 3B Okamoto, CF Abreu, RF Smith; P Cole.
        assert [(e.slot, e.position) for e in game.visitor_lineup] == [
            (0, "LF"), (1, "DH"), (2, "SS"), (3, "1B"), (4, "C"),
            (5, "2B"), (6, "3B"), (7, "CF"), (8, "RF"), (9, "P"),
        ]
        assert [e.pin for e in game.visitor_lineup] == [
            623, 675, 558, 454, 403, 602, 557, 652, 643, 156,
        ]
        # Home SP Rodon is pin 2 (single-digit pin must parse).
        assert game.home_lineup[STARTING_PITCHER_SLOT].pin == 2
        assert game.home_lineup[0].pin == 1536  # 4-digit pin (Lindor)

    def test_first_game_substitutions(self, real_js):
        """Pitching changes and defensive subs are extracted from the play string."""
        game = parse_score_it_js(real_js).games[0]
        subs = [(e.slot, e.position, e.pin) for e in game.substitutions]
        assert (9, "P", 245) in subs  # relief pitcher
        assert (9, "P", 106) in subs
        assert (6, "3B", 4004) in subs  # 4-digit pin defensive sub
        assert subs[0] == (9, "P", 245)  # order preserved

    def test_every_game_has_full_lineups(self, real_js):
        for game in parse_score_it_js(real_js).games:
            for lineup in (game.visitor_lineup, game.home_lineup):
                assert [e.slot for e in lineup] == list(range(10))
                assert lineup[STARTING_PITCHER_SLOT].position == "P"
                assert all(e.position != "P" for e in lineup[:9])

    def test_team_indexes_are_zero_based_ten_teams(self, real_js):
        idxs = set()
        for game in parse_score_it_js(real_js).games:
            idxs.update({game.visitor_idx, game.home_idx})
        assert idxs == set(range(10))


class TestThruDate:
    def test_parses_two_digit_year(self):
        assert parse_thru_date('var thru_date_ = "9-20-26";') == date(2026, 9, 20)

    def test_missing_returns_none(self):
        assert parse_thru_date("var other_ = 1;") is None

    def test_invalid_date_logs_warning(self, caplog):
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.lineup_parser"):
            assert parse_thru_date('var thru_date_ = "13-40-26";') is None
        assert any("not a valid date" in r.message for r in caplog.records)


class TestLineupTokens:
    def test_single_and_multi_digit_pins(self):
        entries = parse_lineup_tokens("f051536f19496f902")
        assert entries == [
            LineupEntry(slot=0, position_code=5, pin=1536),
            LineupEntry(slot=1, position_code=9, pin=496),
            LineupEntry(slot=9, position_code=0, pin=2),
        ]

    def test_tokens_inside_play_string(self):
        entries = parse_lineup_tokens("KOWf90245OSS4f90106KS*")
        assert [(e.slot, e.pin) for e in entries] == [(9, 245), (9, 106)]

    def test_position_property(self):
        assert LineupEntry(slot=0, position_code=9, pin=1).position == "DH"
        assert LineupEntry(slot=0, position_code=42, pin=1).position == "?"

    def test_position_codes_cover_all_ten(self):
        assert set(POSITION_CODES) == set(range(10))


def _record(v_idx, h_idx, v_name, h_name, payload, scores="1,0,0"):
    return f'f({v_idx},{h_idx},"{v_name}","{h_name}",\'{payload}\',{scores});\n'


VALID_V = "f06623f19675f25558f32454f41403f53602f64557f77652f88643f90156"
VALID_H = "f051536f18627f24530f32455f46570f53539f611399f79496f87486f902"


class TestMalformedRecords:
    def test_malformed_payload_is_skipped_with_warning(self, caplog):
        js = (
            'var thru_date_ = "9-20-26";\n'
            + _record(0, 1, "A", "B", "garbage")
            + _record(2, 3, "C", "D", f"{VALID_V},{VALID_H},KOO")
        )
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.lineup_parser"):
            parsed = parse_score_it_js(js)
        assert len(parsed.games) == 1
        assert parsed.games[0].game_no == 1  # skipped record still consumes a number
        assert any("skipping" in r.message for r in caplog.records)

    def test_incomplete_lineup_is_skipped(self, caplog):
        eight_hitters = "f06623f19675f25558f32454f41403f53602f64557f77652f90156"
        js = _record(0, 1, "A", "B", f"{eight_hitters},{VALID_H},KOO")
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.lineup_parser"):
            parsed = parse_score_it_js(js)
        assert parsed.games == []
        assert any("9 hitters + 1 pitcher" in r.message for r in caplog.records)

    def test_team_name_with_apostrophe_and_comma(self):
        js = _record(4, 5, "Bob's Team, Inc.", "The \\\"Quoted\\\" Nine", f"{VALID_V},{VALID_H},KOO")
        parsed = parse_score_it_js(js)
        assert len(parsed.games) == 1
        assert parsed.games[0].visitor_name == "Bob's Team, Inc."
        assert parsed.games[0].visitor_idx == 4

    def test_empty_file_logs_warning(self, caplog):
        with caplog.at_level(logging.WARNING, logger="app.services.scoresheet_scraper.lineup_parser"):
            parsed = parse_score_it_js("")
        assert parsed.games == []
        assert parsed.thru_date is None
        assert any("no game records" in r.message for r in caplog.records)

    def test_no_plays_segment_still_parses(self):
        js = _record(0, 1, "A", "B", f"{VALID_V},{VALID_H}")
        parsed = parse_score_it_js(js)
        assert len(parsed.games) == 1
        assert parsed.games[0].substitutions == []
