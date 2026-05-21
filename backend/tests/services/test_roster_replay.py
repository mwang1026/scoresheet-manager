"""Tests for idempotent replay of -T.js roster events onto a pin snapshot."""

from pathlib import Path

from app.services.scoresheet_scraper.draft_parser import (
    RosterEvent,
    parse_transactions_js,
)
from app.services.scoresheet_scraper.parser import parse_league_rosters_js
from app.services.scoresheet_scraper.roster_replay import apply_roster_events

FIXTURES = Path(__file__).parent.parent / "fixtures"


def _event(
    *,
    team_a: int,
    team_b: int,
    out: list[int] | None = None,
    in_: list[int] | None = None,
    month: int = 4,
    day: int = 16,
    source_order: int = 0,
) -> RosterEvent:
    return RosterEvent(
        month=month,
        day=day,
        team_a=team_a,
        team_b=team_b,
        players_out=out or [],
        players_in=in_ or [],
        source_order=source_order,
    )


class TestApplyRosterEvents:
    def test_trade_moves_player_when_source_owns_it(self):
        """The AL_Catfish_Hunter case: trade applied when pins are stale."""
        base = {1: {73, 4053, 13}, 9: {42, 1539, 26}}
        events = [_event(team_a=9, team_b=1, out=[1539], in_=[4053])]

        rosters, warnings = apply_roster_events(base, events)

        assert 1539 in rosters[1]
        assert 1539 not in rosters[9]
        assert 4053 in rosters[9]
        assert 4053 not in rosters[1]
        assert warnings == []

    def test_trade_idempotent_when_destination_already_owns(self):
        """If pins already reflect the trade, the replay is a no-op."""
        base = {1: {73, 1539, 13}, 9: {42, 4053, 26}}
        events = [_event(team_a=9, team_b=1, out=[1539], in_=[4053])]

        rosters, warnings = apply_roster_events(base, events)

        assert rosters[1] == {73, 1539, 13}
        assert rosters[9] == {42, 4053, 26}
        assert warnings == []

    def test_double_trade_chain_applied_correctly(self):
        """A→B then B→C: replaying on stale pins still lands the player on C."""
        # Pins show pre-trade state (player 1539 still on team 9).
        base = {1: {73}, 5: set(), 9: {1539}}
        events = [
            _event(team_a=9, team_b=1, out=[1539], source_order=0),
            _event(team_a=1, team_b=5, out=[1539], source_order=1),
        ]

        rosters, _ = apply_roster_events(base, events)

        assert 1539 in rosters[5]
        assert 1539 not in rosters[1]
        assert 1539 not in rosters[9]

    def test_double_trade_chain_idempotent_when_fully_applied(self):
        """If pins already show the final state, replay does not corrupt it.

        The intermediate event (9 → 1) hits the third-party warning path
        because the player is on team 5, neither side of that link. That's
        acceptable: in production, pins are either pre-freeze (no events
        applied) or post-freeze (no events applied), never partially applied.
        We assert state integrity here; a warning is honest.
        """
        base = {1: set(), 5: {1539}, 9: set()}
        events = [
            _event(team_a=9, team_b=1, out=[1539], source_order=0),
            _event(team_a=1, team_b=5, out=[1539], source_order=1),
        ]

        rosters, warnings = apply_roster_events(base, events)
        # Final state preserved regardless.
        assert rosters[5] == {1539}
        assert rosters[1] == set()
        assert rosters[9] == set()

    def test_fa_drop_applied(self):
        base = {6: {549, 100}}
        events = [_event(team_a=6, team_b=0, out=[549])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[6] == {100}
        assert warnings == []

    def test_fa_drop_idempotent_when_player_already_gone(self):
        base = {6: {100}}
        events = [_event(team_a=6, team_b=0, out=[549])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[6] == {100}
        assert warnings == []  # drop of unowned player is a silent no-op

    def test_fa_pickup_applied_when_player_unowned(self):
        base = {5: {1}, 6: {2}}
        events = [_event(team_a=5, team_b=0, in_=[731])]
        rosters, warnings = apply_roster_events(base, events)
        assert 731 in rosters[5]
        assert warnings == []

    def test_fa_pickup_idempotent_when_team_already_owns(self):
        base = {5: {731, 1}}
        events = [_event(team_a=5, team_b=0, in_=[731])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[5] == {731, 1}
        assert warnings == []

    def test_fa_pickup_warns_on_conflict_with_other_team(self):
        """If another team already owns the player, log + skip."""
        base = {5: {1}, 6: {731}}
        events = [_event(team_a=5, team_b=0, in_=[731])]
        rosters, warnings = apply_roster_events(base, events)
        # Player stays with current owner; nothing added to team 5.
        assert rosters[6] == {731}
        assert 731 not in rosters[5]
        assert len(warnings) == 1

    def test_warns_on_orphan_move(self):
        """If neither source nor destination owns the player, warn and skip."""
        base = {1: {1}, 9: {2}}
        events = [_event(team_a=9, team_b=1, out=[1539])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[1] == {1}
        assert rosters[9] == {2}
        assert len(warnings) == 1

    def test_warns_when_player_on_third_party(self):
        """Player turned up somewhere unexpected — log + skip."""
        base = {1: set(), 3: {1539}, 9: set()}
        events = [_event(team_a=9, team_b=1, out=[1539])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[3] == {1539}
        assert len(warnings) == 1

    def test_combined_drop_and_add(self):
        """r(2,16,2,0,[559],[560]) — single event drops AND adds."""
        base = {2: {559, 100}}
        events = [_event(team_a=2, team_b=0, out=[559], in_=[560])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[2] == {100, 560}
        assert warnings == []

    def test_input_not_mutated(self):
        """apply_roster_events returns a fresh dict; original is untouched."""
        base = {1: {73}, 9: {1539}}
        events = [_event(team_a=9, team_b=1, out=[1539])]
        apply_roster_events(base, events)
        assert base == {1: {73}, 9: {1539}}

    def test_two_team_trade_with_both_directions(self):
        """Player swap recorded in a single (deduped) event."""
        base = {1: {4053}, 9: {1539}}
        events = [_event(team_a=9, team_b=1, out=[1539], in_=[4053])]
        rosters, warnings = apply_roster_events(base, events)
        assert rosters[1] == {1539}
        assert rosters[9] == {4053}
        assert warnings == []


class TestAlCatfishHunterFixture:
    """End-to-end replay against real captured AL_Catfish_Hunter JS.

    Demonstrates the original bug: the 5/16 trade r(4,16,9,1,[1539],[4053])
    is missing from pin state. After replay, 1539 lands on team 1 and 4053
    on team 9.
    """

    def test_post_draft_trade_lands_correctly(self):
        league_js = (FIXTURES / "al_catfish_hunter.js").read_text()
        trans_js = (FIXTURES / "al_catfish_hunter_T.js").read_text()

        pin_rosters = parse_league_rosters_js(league_js)
        base = {r.scoresheet_id: set(r.pins) for r in pin_rosters}

        # Pre-condition: trade is NOT reflected in raw pins.
        assert 1539 in base[9]
        assert 4053 in base[1]

        events = parse_transactions_js(trans_js).roster_events
        rosters, warnings = apply_roster_events(base, events)

        # Post-condition: trade applied.
        assert 1539 in rosters[1]
        assert 4053 in rosters[9]
        assert 1539 not in rosters[9]
        assert 4053 not in rosters[1]

        # 3/21 unpaired drop+add r(3,21,3,0,[509],[271]):
        # 509 was already dropped pre-freeze (not in pins anywhere) and 271 was
        # already added to team 3. Replay should be a clean no-op (no warnings).
        assert 271 in rosters[3]
        assert all(509 not in s for s in rosters.values())
        assert warnings == []
