"""
Tests for the Scoresheet draft parser.

All tests use inline JS strings — no I/O, no network calls.
"""

import math

import pytest

from app.services.scoresheet_scraper.draft_parser import (
    CompletedPick,
    DraftConfig,
    ParsedTransactions,
    PicksSchedule,
    UpcomingPick,
    _pt_minus_gaps,
    _pt_plus_gaps,
    compute_upcoming_picks,
    parse_draft_config,
    parse_transactions_js,
    pick_ms1970,
)


# ---------------------------------------------------------------------------
# Fixtures: inline JS derived from real Scoresheet data
# ---------------------------------------------------------------------------

LEAGUE_JS_WITH_DRAFT = """
var lg_ = {
  owner_names : ["Alice","Bob","Carol","Dave","Eve","Frank","Grace","Henry","Irene","Jack"],
  picks_sched: { last_pt: 1774059900, last_r1: 35, start_r1: 14,
                 n_skips_todo: 52, total_pt: 2737470 },
  t1a_odd_r1: [8,5,9,10,6,7,3,2,4,1],
  t1a_even_r1: [1,4,2,3,7,6,10,9,5,8],
  n_picks_done: 0,
  round1_: 14,
  rosters: [
    { pins: [5,34,73], omit_r1s: [], extra_picks: [] },
    { pins: [18,20], omit_r1s: [], extra_picks: [] },
    { pins: [25,90], omit_r1s: [], extra_picks: [] },
    { pins: [12,55], omit_r1s: [32,33,34,35], extra_picks: [] },
    { pins: [44,88], omit_r1s: [], extra_picks: [{f1:4,r1:32}] },
    { pins: [99], omit_r1s: [], extra_picks: [] },
    { pins: [71], omit_r1s: [], extra_picks: [] },
    { pins: [82], omit_r1s: [], extra_picks: [] },
    { pins: [63], omit_r1s: [], extra_picks: [] },
    { pins: [41], omit_r1s: [], extra_picks: [] }
  ]
};
"""

LEAGUE_JS_NO_DRAFT = """
var lg_ = {
  owner_names : ["Alice","Bob","Carol","Dave","Eve","Frank","Grace","Henry","Irene","Jack"],
  t1a_odd_r1: [8,5,9,10,6,7,3,2,4,1],
  t1a_even_r1: [1,4,2,3,7,6,10,9,5,8],
  n_picks_done: 220,
  round1_: 14,
  rosters: [
    { pins: [5,34,73], omit_r1s: [], extra_picks: [] },
    { pins: [18,20], omit_r1s: [], extra_picks: [] },
    { pins: [25,90], omit_r1s: [], extra_picks: [] },
    { pins: [12,55], omit_r1s: [], extra_picks: [] },
    { pins: [44,88], omit_r1s: [], extra_picks: [] },
    { pins: [99], omit_r1s: [], extra_picks: [] },
    { pins: [71], omit_r1s: [], extra_picks: [] },
    { pins: [82], omit_r1s: [], extra_picks: [] },
    { pins: [63], omit_r1s: [], extra_picks: [] },
    { pins: [41], omit_r1s: [], extra_picks: [] }
  ]
};
"""

TRANSACTIONS_JS = """\
round1_=14;
p(8,20);
p(5,78);
p(9,371);
p(10,42);
p(6,115);
p(7,200);
p(3,88);
p(2,55);
p(4,12,7);
p(1,99);
round1_=15;
p(1,301);
p(4,302);
r(1,12,4,7,[],[],[{f1:4,r1:15}],[{f1:7,r1:13}]);
m(0,28,'some message');
pm('public message');
p(2,303);
"""

TRANSACTIONS_JS_EMPTY = """\
round1_=14;
"""

LEAGUE_JS_MISSING_ORDER = """
var lg_ = {
  owner_names : ["Alice","Bob"],
  rosters: [
    { pins: [5], omit_r1s: [], extra_picks: [] },
    { pins: [6], omit_r1s: [], extra_picks: [] }
  ]
};
"""


# ---------------------------------------------------------------------------
# TestParseDraftConfig
# ---------------------------------------------------------------------------


class TestParseDraftConfig:
    def test_parses_picks_sched(self):
        """Extracts picks_sched parameters from league JS."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)

        assert config.picks_sched is not None
        assert config.picks_sched.last_pt == 1774059900
        assert config.picks_sched.last_r1 == 35
        assert config.picks_sched.start_r1 == 14
        assert config.picks_sched.n_skips_todo == 52
        assert config.picks_sched.total_pt == 2737470

    def test_parses_draft_order(self):
        """Extracts t1a_odd_r1 and t1a_even_r1."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)

        assert config.t1a_odd_r1 == [8, 5, 9, 10, 6, 7, 3, 2, 4, 1]
        assert config.t1a_even_r1 == [1, 4, 2, 3, 7, 6, 10, 9, 5, 8]
        assert config.n_teams == 10

    def test_parses_omit_r1s(self):
        """Extracts omit_r1s from roster blocks."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)

        assert 4 in config.omit_r1s
        assert config.omit_r1s[4] == [32, 33, 34, 35]
        # Other teams have empty omit_r1s — not in dict
        assert 1 not in config.omit_r1s

    def test_parses_extra_picks(self):
        """Extracts extra_picks from roster blocks."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)

        assert 5 in config.extra_picks
        assert len(config.extra_picks[5]) == 1
        assert config.extra_picks[5][0] == {"f1": 4, "r1": 32}

    def test_parses_n_picks_done(self):
        """Extracts n_picks_done."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        assert config.n_picks_done == 0

    def test_parses_round1(self):
        """Extracts round1_ display start round."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        assert config.round1 == 14

    def test_no_active_draft(self):
        """picks_sched is None when not present in JS."""
        config = parse_draft_config(LEAGUE_JS_NO_DRAFT)
        assert config.picks_sched is None
        assert config.n_picks_done == 220

    def test_missing_draft_order_raises(self):
        """Raises ValueError when t1a_odd_r1 or t1a_even_r1 missing."""
        with pytest.raises(ValueError, match="Missing t1a_odd_r1"):
            parse_draft_config(LEAGUE_JS_MISSING_ORDER)


# ---------------------------------------------------------------------------
# TestParseTransactionsJs
# ---------------------------------------------------------------------------


class TestParseTransactionsJs:
    def test_parses_picks(self):
        """Extracts p() calls as CompletedPick objects."""
        result = parse_transactions_js(TRANSACTIONS_JS)

        assert len(result.completed_picks) == 13

        # First pick in round 14
        pick = result.completed_picks[0]
        assert pick.round == 14
        assert pick.team_number == 8
        assert pick.player_scoresheet_id == 20
        assert pick.from_team_number is None

    def test_parses_traded_pick(self):
        """Handles p(team, ssid, from_team) three-arg form."""
        result = parse_transactions_js(TRANSACTIONS_JS)

        # p(4,12,7) — team 4 using team 7's pick
        traded = [p for p in result.completed_picks if p.from_team_number is not None]
        assert len(traded) == 1
        assert traded[0].team_number == 4
        assert traded[0].player_scoresheet_id == 12
        assert traded[0].from_team_number == 7

    def test_tracks_round_markers(self):
        """round1_ updates are tracked across picks."""
        result = parse_transactions_js(TRANSACTIONS_JS)

        round_14 = [p for p in result.completed_picks if p.round == 14]
        round_15 = [p for p in result.completed_picks if p.round == 15]

        assert len(round_14) == 10
        assert len(round_15) == 3

    def test_final_round1(self):
        """final_round1 is the last round1_ value."""
        result = parse_transactions_js(TRANSACTIONS_JS)
        assert result.final_round1 == 15

    def test_empty_transactions(self):
        """Empty -T.js with just a round marker."""
        result = parse_transactions_js(TRANSACTIONS_JS_EMPTY)
        assert len(result.completed_picks) == 0
        assert result.final_round1 == 14

    def test_ignores_trade_and_message_lines(self):
        """r(), m(), and pm() calls are ignored."""
        result = parse_transactions_js(TRANSACTIONS_JS)
        # Only p() calls should be in completed_picks
        for pick in result.completed_picks:
            assert isinstance(pick, CompletedPick)

    def test_skips_passed_picks_with_ssid_zero(self):
        """SSID=0 is Scoresheet's sentinel for a passed/skipped pick.

        These should be filtered out at parse time so downstream code never
        tries (and fails) to resolve them to a player.
        """
        js = "round1_=14;\np(8,100);\np(5,0);\np(0,0);\np(3,200);\n"
        result = parse_transactions_js(js)

        ssids = [p.player_scoresheet_id for p in result.completed_picks]
        assert ssids == [100, 200]
        assert all(p.player_scoresheet_id > 0 for p in result.completed_picks)


# ---------------------------------------------------------------------------
# TestPickTiming
# ---------------------------------------------------------------------------


class TestPickTiming:
    def test_pt_minus_gaps_removes_overnight(self):
        """_pt_minus_gaps reduces time by removing 7hr overnight gaps."""
        # A timestamp at noon should have minimal gap removal
        noon = 43200  # exactly noon offset
        assert _pt_minus_gaps(noon) == noon - 25200 * math.floor(0)

    def test_pt_plus_gaps_inverse(self):
        """_pt_plus_gaps adds back overnight gaps."""
        # Verify round-trip for a known timestamp
        t = 1774059900
        compressed = _pt_minus_gaps(t)
        expanded = _pt_plus_gaps(compressed)
        # The round-trip should give back the original (or very close)
        assert abs(expanded - t) < 86400  # within one day

    def test_pick_ms1970_returns_milliseconds(self):
        """pick_ms1970 returns time in milliseconds since epoch."""
        sched = PicksSchedule(
            last_pt=1774059900,
            last_r1=35,
            start_r1=14,
            n_skips_todo=52,
            total_pt=2737470,
        )
        ms = pick_ms1970(0, sched, 10)
        assert ms > 0
        assert ms > 1000000000000  # Reasonable epoch ms (post-2001)
        assert ms < 2000000000000  # Not unreasonably far future

    def test_pick_ms1970_monotonic(self):
        """Later pick indices should produce later times."""
        sched = PicksSchedule(
            last_pt=1774059900,
            last_r1=35,
            start_r1=14,
            n_skips_todo=52,
            total_pt=2737470,
        )
        times = [pick_ms1970(i, sched, 10) for i in range(0, 350)]
        for i in range(1, len(times)):
            assert times[i] >= times[i - 1], f"Time decreased at index {i}"

    def test_last_pick_time_matches_last_pt(self):
        """The last pick should be close to last_pt."""
        sched = PicksSchedule(
            last_pt=1774059900,
            last_r1=35,
            start_r1=14,
            n_skips_todo=52,
            total_pt=2737470,
        )
        n_teams = 10
        last_index = sched.last_r1 * n_teams - 1  # 349
        ms = pick_ms1970(last_index, sched, n_teams)
        # Should be within a day of last_pt
        assert abs(ms / 1000 - sched.last_pt) < 86400


# ---------------------------------------------------------------------------
# TestComputeUpcomingPicks
# ---------------------------------------------------------------------------


class TestComputeUpcomingPicks:
    def test_returns_picks_for_active_draft(self):
        """Computes upcoming picks when picks_sched is present."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        assert len(picks) > 0
        assert all(isinstance(p, UpcomingPick) for p in picks)

    def test_returns_empty_when_no_draft(self):
        """Returns empty list when no picks_sched."""
        config = parse_draft_config(LEAGUE_JS_NO_DRAFT)
        picks = compute_upcoming_picks(config)
        assert picks == []

    def test_pick_order_follows_draft_order(self):
        """First round's picks follow t1a_odd_r1 order (round 14 is even, so t1a_even_r1)."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        # Round 14 is even, so order should follow t1a_even_r1
        round_14_picks = [p for p in picks if p.round == 14]
        expected_order = [1, 4, 2, 3, 7, 6, 10, 9, 5, 8]
        actual_teams = [p.team_number for p in round_14_picks]
        assert actual_teams == expected_order

    def test_picks_ordered_by_time(self):
        """Picks should be in chronological order."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        for i in range(1, len(picks)):
            assert picks[i].scheduled_at >= picks[i - 1].scheduled_at

    def test_omit_r1s_handled(self):
        """Team 4 skips rounds 32-35 (traded away)."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        # Team 4 should not have picks in rounds 32-35
        team4_picks = [p for p in picks if p.team_number == 4 and p.from_team_number is None]
        team4_rounds = {p.round for p in team4_picks}
        for rnd in [32, 33, 34, 35]:
            assert rnd not in team4_rounds

    def test_extra_picks_reassignment(self):
        """Team 5 has extra pick: {f1:4, r1:32} — gets team 4's round 32 slot."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        # Team 5 should have a pick in round 32 from team 4
        team5_r32 = [
            p for p in picks if p.team_number == 5 and p.round == 32 and p.from_team_number == 4
        ]
        assert len(team5_r32) == 1

    def test_pick_count_accounts_for_trades(self):
        """Total picks should be n_teams * n_rounds minus skipped slots + traded slots."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        # Rounds 14-35 = 22 rounds × 10 teams = 220 slots
        # Team 4 omits rounds 32-35 = 4 omitted
        # Team 5 gets round 32 from team 4 = 1 extra pick (reassignment)
        # Rounds 33-35 from team 4: not reassigned to anyone = 3 skipped
        # Total: 220 - 3 = 217
        assert len(picks) == 217

    def test_pick_in_round_1_indexed(self):
        """pick_in_round should be 1-indexed."""
        config = parse_draft_config(LEAGUE_JS_WITH_DRAFT)
        picks = compute_upcoming_picks(config)

        for rnd in range(14, 36):
            round_picks = [p for p in picks if p.round == rnd]
            if round_picks:
                assert round_picks[0].pick_in_round == 1
