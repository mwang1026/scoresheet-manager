"""
Idempotent replay of -T.js roster events on top of a base roster snapshot.

Scoresheet's main league JS freezes its ``pins[]`` arrays around the end of the
supplemental draft. In-season trades, drops, and FA pickups are only recorded
in the transactions JS as ``r()`` lines (see RosterEvent). Pin state therefore
diverges from reality after the freeze, and we need to apply r() events on top
of it.

Pre-freeze r() events are already reflected in pins. To stay idempotent across
the freeze point, every replay decision checks current ownership and skips
no-op moves. This handles partial pin updates, replayed events, and double
trades (A → B → C) without double-counting.

Pure functions only — no I/O. Callers pass in/receive ``{team_ssid: {player_ssid}}``
maps and a list of warning strings to surface to ops.
"""

import logging

from .draft_parser import RosterEvent

logger = logging.getLogger(__name__)

# Sentinel for the free-agent pool in Scoresheet r() lines.
FA_TEAM = 0


def apply_roster_events(
    base_rosters: dict[int, set[int]],
    events: list[RosterEvent],
) -> tuple[dict[int, set[int]], list[str]]:
    """Apply roster events to a base snapshot, returning new state + warnings.

    ``base_rosters`` is keyed by 1-indexed team scoresheet_id; values are sets
    of player SSIDs. The input is not mutated.

    Events are applied in the order given (caller should pass chronological
    order). For each event, every player move is checked against current
    ownership and skipped if already reflected:

      - Move out (player goes from team_a → team_b, team_b != FA): only fires
        if team_a currently owns the player. If team_b already owns it, the
        event is treated as already applied.
      - Drop (team_b == FA, player in players_out): only fires if team_a owns
        the player.
      - FA pickup (team_b == FA, player in players_in): only fires if no team
        currently owns the player; conflicts are logged and skipped.
      - Two-team trade pickup (team_b != FA, player in players_in): handled
        symmetrically as a move team_b → team_a.

    Warnings are returned (and also logged) for: third-party ownership of a
    moved player, FA pickup conflicting with current ownership, and orphaned
    moves where neither side owns the player.
    """
    rosters: dict[int, set[int]] = {team: set(pins) for team, pins in base_rosters.items()}
    warnings: list[str] = []

    def _owner_of(player: int) -> int | None:
        for team, pins in rosters.items():
            if player in pins:
                return team
        return None

    def _warn(msg: str) -> None:
        warnings.append(msg)
        logger.warning(msg)

    for event in events:
        # Out-moves: team_a → team_b (or team_a → FA).
        for player in event.players_out:
            _move(
                player=player,
                src=event.team_a,
                dst=event.team_b,
                rosters=rosters,
                owner_of=_owner_of,
                warn=_warn,
                event=event,
            )

        # In-moves: team_b → team_a (or FA → team_a).
        for player in event.players_in:
            _move(
                player=player,
                src=event.team_b,
                dst=event.team_a,
                rosters=rosters,
                owner_of=_owner_of,
                warn=_warn,
                event=event,
            )

    return rosters, warnings


def _move(
    *,
    player: int,
    src: int,
    dst: int,
    rosters: dict[int, set[int]],
    owner_of,
    warn,
    event: RosterEvent,
) -> None:
    """Apply a single player move src → dst, skipping if already reflected.

    Handles four ownership cases:
      1. src owns player → remove from src, add to dst (unless dst is FA).
      2. dst owns player (and dst != FA) → already applied, skip.
      3. Some other team owns → log warning, leave alone.
      4. No one owns → if src == FA, add to dst; else log warning (orphan).
    """
    current = owner_of(player)

    if src != FA_TEAM and current == src:
        rosters[src].discard(player)
        if dst != FA_TEAM:
            rosters.setdefault(dst, set()).add(player)
        return

    if dst != FA_TEAM and current == dst:
        return  # already applied

    if current is not None and current not in (src, dst):
        warn(
            f"r({event.month},{event.day}) player {player}: expected on team "
            f"{src} but currently on team {current}; skipping"
        )
        return

    if current is None:
        if src == FA_TEAM and dst != FA_TEAM:
            rosters.setdefault(dst, set()).add(player)
            return
        if dst == FA_TEAM:
            return  # drop of an unowned player — no-op
        warn(
            f"r({event.month},{event.day}) player {player}: expected on team "
            f"{src} but not currently rostered; skipping"
        )
