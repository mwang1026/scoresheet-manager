"""Tests for lineup derivation (app.services.lineups)."""

from datetime import date

from app.models import GameLineup, Player
from app.services.lineups import derive_team_lineups, pitcher_hand
from app.services.scoresheet_scraper.lineup_parser import STARTING_PITCHER_SLOT

WEEK = date(2026, 9, 20)


def _rows(game_no: int, team_id: int, opponent_id: int, is_home: bool,
          hitters: list[tuple[int, int]], sp_pin: int, subs: list[tuple[int, int, int]] = ()):
    """Build GameLineup rows for one team in one game.

    hitters: list of (position_code, pin) in batting order
    subs: list of (slot, position_code, pin)
    """
    rows = []
    seq = 0
    for slot, (pos, pin) in enumerate(hitters):
        rows.append(GameLineup(
            league_id=1, week_end=WEEK, game_no=game_no, team_id=team_id,
            opponent_team_id=opponent_id, is_home=is_home, seq=seq, slot=slot,
            position_code=pos, pin=pin, player_id=pin * 10, is_starter=True,
        ))
        seq += 1
    rows.append(GameLineup(
        league_id=1, week_end=WEEK, game_no=game_no, team_id=team_id,
        opponent_team_id=opponent_id, is_home=is_home, seq=seq,
        slot=STARTING_PITCHER_SLOT, position_code=0, pin=sp_pin, player_id=sp_pin * 10,
        is_starter=True,
    ))
    seq += 1
    for slot, pos, pin in subs:
        rows.append(GameLineup(
            league_id=1, week_end=WEEK, game_no=game_no, team_id=team_id,
            opponent_team_id=opponent_id, is_home=is_home, seq=seq, slot=slot,
            position_code=pos, pin=pin, player_id=pin * 10, is_starter=False,
        ))
        seq += 1
    return rows


NINE_A = [(6, 101), (9, 102), (5, 103), (2, 104), (1, 105), (3, 106), (4, 107), (7, 108), (8, 109)]
# Same players, two swapped in the order (a different lineup key).
NINE_A_ALT = [NINE_A[1], NINE_A[0]] + NINE_A[2:]
NINE_B = [(6, 201), (9, 202), (5, 203), (2, 204), (1, 205), (3, 206), (4, 207), (7, 208), (8, 209)]


class TestDeriveTeamLineups:
    def test_splits_by_opposing_starter_hand(self):
        # Team 1 plays team 2 three times; team 2 starts a LHP (pin 901) in game 1
        # and RHPs (902, 903) in games 2 and 3. Team 1 uses NINE_A_ALT vs the lefty.
        rows = []
        rows += _rows(0, 1, 2, False, NINE_A_ALT, sp_pin=301)
        rows += _rows(0, 2, 1, True, NINE_B, sp_pin=901)
        rows += _rows(1, 1, 2, False, NINE_A, sp_pin=302)
        rows += _rows(1, 2, 1, True, NINE_B, sp_pin=902)
        rows += _rows(2, 1, 2, False, NINE_A, sp_pin=303)
        rows += _rows(2, 2, 1, True, NINE_B, sp_pin=903)
        hands = {9010: "L", 9020: "R", 9030: "R", 3010: "R", 3020: "R", 3030: "R"}

        result = {t.team_id: t for t in derive_team_lineups(rows, hands)}
        team1 = result[1]
        assert team1.games == 3
        assert team1.unknown_hand_games == 0
        assert [s.pin for s in team1.vs_rhp] == [pin for _, pin in NINE_A]
        assert [s.pin for s in team1.vs_lhp] == [pin for _, pin in NINE_A_ALT]
        assert [s.position for s in team1.vs_rhp][:3] == ["LF", "DH", "SS"]
        assert [s.player_id for s in team1.vs_rhp][:2] == [1010, 1020]

    def test_no_games_vs_lhp_yields_none(self):
        rows = _rows(0, 1, 2, False, NINE_A, sp_pin=301) + _rows(0, 2, 1, True, NINE_B, sp_pin=901)
        result = derive_team_lineups(rows, {9010: "R", 3010: "R"})
        team1 = next(t for t in result if t.team_id == 1)
        assert team1.vs_lhp is None
        assert team1.vs_rhp is not None

    def test_unknown_hand_counts_and_buckets_as_rhp(self):
        rows = _rows(0, 1, 2, False, NINE_A, sp_pin=301) + _rows(0, 2, 1, True, NINE_B, sp_pin=901)
        result = derive_team_lineups(rows, {})  # no hands known
        team1 = next(t for t in result if t.team_id == 1)
        assert team1.unknown_hand_games == 1
        assert team1.vs_lhp is None
        assert [s.pin for s in team1.vs_rhp] == [pin for _, pin in NINE_A]

    def test_modal_lineup_prefers_most_common_then_most_recent(self):
        rows = []
        # Games 0 and 1: NINE_A; game 2: NINE_A_ALT. All vs RHP.
        for game_no, nine in enumerate([NINE_A, NINE_A, NINE_A_ALT]):
            rows += _rows(game_no, 1, 2, False, nine, sp_pin=301 + game_no)
            rows += _rows(game_no, 2, 1, True, NINE_B, sp_pin=901)
        team1 = next(t for t in derive_team_lineups(rows, {9010: "R"}) if t.team_id == 1)
        assert [s.pin for s in team1.vs_rhp] == [pin for _, pin in NINE_A]

        # Tie (one each): most recent wins.
        rows = []
        for game_no, nine in enumerate([NINE_A, NINE_A_ALT]):
            rows += _rows(game_no, 1, 2, False, nine, sp_pin=301 + game_no)
            rows += _rows(game_no, 2, 1, True, NINE_B, sp_pin=901)
        team1 = next(t for t in derive_team_lineups(rows, {9010: "R"}) if t.team_id == 1)
        assert [s.pin for s in team1.vs_rhp] == [pin for _, pin in NINE_A_ALT]

    def test_rotation_in_first_appearance_order_with_counts(self):
        rows = []
        for game_no, sp in enumerate([301, 302, 303, 301]):
            rows += _rows(game_no, 1, 2, False, NINE_A, sp_pin=sp)
            rows += _rows(game_no, 2, 1, True, NINE_B, sp_pin=901)
        team1 = next(t for t in derive_team_lineups(rows, {}) if t.team_id == 1)
        assert [(p.pin, p.games) for p in team1.rotation] == [(301, 2), (302, 1), (303, 1)]
        assert team1.rotation[0].player_id == 3010

    def test_relievers_ranked_by_usage(self):
        rows = []
        rows += _rows(0, 1, 2, False, NINE_A, sp_pin=301,
                      subs=[(9, 0, 401), (9, 0, 402), (3, 5, 777)])  # 777 is a defensive sub
        rows += _rows(0, 2, 1, True, NINE_B, sp_pin=901)
        rows += _rows(1, 1, 2, False, NINE_A, sp_pin=302, subs=[(9, 0, 402)])
        rows += _rows(1, 2, 1, True, NINE_B, sp_pin=902)
        team1 = next(t for t in derive_team_lineups(rows, {}) if t.team_id == 1)
        assert [(p.pin, p.games) for p in team1.relievers] == [(402, 2), (401, 1)]

    def test_empty_rows(self):
        assert derive_team_lineups([], {}) == []

    def test_results_sorted_by_team_id(self):
        rows = _rows(0, 5, 3, False, NINE_A, sp_pin=301) + _rows(0, 3, 5, True, NINE_B, sp_pin=901)
        assert [t.team_id for t in derive_team_lineups(rows, {})] == [3, 5]


class TestPitcherHand:
    def test_prefers_throws_then_bats(self):
        assert pitcher_hand(Player(first_name="a", last_name="b", primary_position="P", throws="L", bats="R")) == "L"
        assert pitcher_hand(Player(first_name="a", last_name="b", primary_position="P", bats="R")) == "R"
        assert pitcher_hand(Player(first_name="a", last_name="b", primary_position="P")) is None
        assert pitcher_hand(None) is None
