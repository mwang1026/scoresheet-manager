"""
Derive each team's working lineup from scraped game_lineups rows.

Scoresheet owners submit one batting order vs RHP and one vs LHP. The
Score-It file only shows what was used game by game, so we reconstruct the
two orders by grouping a team's games by the opposing starter's throwing
hand and taking the most common lineup in each group. The rotation is the
distinct starting pitchers in the order they first appeared; relievers are
in-game pitching substitutions ranked by how often they were used.

Pure functions — the endpoint loads rows and hands, this module computes.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Sequence

from app.models import GameLineup, Player
from app.services.scoresheet_scraper.lineup_parser import (
    PITCHER_POSITION_CODE,
    POSITION_CODES,
    STARTING_PITCHER_SLOT,
)

LEFT_HANDED = "L"


@dataclass(frozen=True)
class LineupSlotOut:
    slot: int
    position: str
    pin: int
    player_id: int | None


@dataclass(frozen=True)
class LineupPitcherOut:
    pin: int
    player_id: int | None
    games: int


@dataclass
class TeamLineupOut:
    team_id: int
    games: int
    unknown_hand_games: int
    vs_rhp: list[LineupSlotOut] | None
    vs_lhp: list[LineupSlotOut] | None
    rotation: list[LineupPitcherOut] = field(default_factory=list)
    relievers: list[LineupPitcherOut] = field(default_factory=list)


def pitcher_hand(player: Player | None) -> str | None:
    """
    Throwing hand for a pitcher.

    The Scoresheet player import stores the TSV ``h`` column in ``bats``;
    for pitchers that column is the throwing hand. ``throws`` is preferred
    when populated.
    """
    if player is None:
        return None
    return player.throws or player.bats


def _lineup_key(starters: Sequence[GameLineup]) -> tuple[tuple[int, int, int], ...]:
    return tuple(
        (r.slot, r.position_code, r.pin)
        for r in sorted(starters, key=lambda r: r.slot)
        if r.slot != STARTING_PITCHER_SLOT
    )


def _to_slots(starters: Sequence[GameLineup]) -> list[LineupSlotOut]:
    return [
        LineupSlotOut(
            slot=r.slot,
            position=POSITION_CODES.get(r.position_code, "?"),
            pin=r.pin,
            player_id=r.player_id,
        )
        for r in sorted(starters, key=lambda r: r.slot)
        if r.slot != STARTING_PITCHER_SLOT
    ]


def _modal_lineup(
    games: list[tuple[int, list[GameLineup]]],
) -> list[LineupSlotOut] | None:
    """Most frequent starting nine; ties go to the most recent game."""
    if not games:
        return None
    counts: Counter[tuple] = Counter()
    latest_game_no: dict[tuple, int] = {}
    starters_by_key: dict[tuple, list[GameLineup]] = {}
    for game_no, starters in games:
        key = _lineup_key(starters)
        counts[key] += 1
        latest_game_no[key] = max(latest_game_no.get(key, -1), game_no)
        starters_by_key[key] = starters
    best = max(counts, key=lambda k: (counts[k], latest_game_no[k]))
    return _to_slots(starters_by_key[best])


def derive_team_lineups(
    rows: Iterable[GameLineup],
    hand_by_player_id: dict[int, str | None],
) -> list[TeamLineupOut]:
    """
    Derive per-team lineups from one week of game_lineups rows.

    Args:
        rows: all rows for a single (league, week_end)
        hand_by_player_id: throwing hand for every starting pitcher's player_id

    Returns one TeamLineupOut per team that appears in the rows, sorted by team_id.
    """
    # (game_no, team_id) -> rows for that team in that game
    by_game_team: dict[tuple[int, int], list[GameLineup]] = defaultdict(list)
    for row in rows:
        by_game_team[(row.game_no, row.team_id)].append(row)

    # Opposing starter per (game_no, team_id): the other side's slot-9 starter.
    opp_sp: dict[tuple[int, int], GameLineup | None] = {}
    for (game_no, team_id), team_rows in by_game_team.items():
        opponent_id = team_rows[0].opponent_team_id
        opp_rows = by_game_team.get((game_no, opponent_id), [])
        opp_sp[(game_no, team_id)] = next(
            (r for r in opp_rows if r.is_starter and r.slot == STARTING_PITCHER_SLOT),
            None,
        )

    team_ids = sorted({team_id for _, team_id in by_game_team})
    results: list[TeamLineupOut] = []
    for team_id in team_ids:
        games_for_team = sorted(
            ((game_no, team_rows) for (game_no, tid), team_rows in by_game_team.items() if tid == team_id),
            key=lambda item: item[0],
        )

        vs_rhp_games: list[tuple[int, list[GameLineup]]] = []
        vs_lhp_games: list[tuple[int, list[GameLineup]]] = []
        unknown_hand_games = 0
        rotation_counts: Counter[int] = Counter()
        rotation_order: list[int] = []
        rotation_player: dict[int, int | None] = {}
        reliever_counts: Counter[int] = Counter()
        reliever_order: list[int] = []
        reliever_player: dict[int, int | None] = {}

        for game_no, team_rows in games_for_team:
            starters = [r for r in team_rows if r.is_starter]
            sp = opp_sp.get((game_no, team_id))
            hand = hand_by_player_id.get(sp.player_id) if sp and sp.player_id else None
            if hand is None:
                unknown_hand_games += 1
            if hand == LEFT_HANDED:
                vs_lhp_games.append((game_no, starters))
            else:
                vs_rhp_games.append((game_no, starters))

            for r in starters:
                if r.slot == STARTING_PITCHER_SLOT:
                    if r.pin not in rotation_counts:
                        rotation_order.append(r.pin)
                        rotation_player[r.pin] = r.player_id
                    rotation_counts[r.pin] += 1

            for r in team_rows:
                if not r.is_starter and r.position_code == PITCHER_POSITION_CODE:
                    if r.pin not in reliever_counts:
                        reliever_order.append(r.pin)
                        reliever_player[r.pin] = r.player_id
                    reliever_counts[r.pin] += 1

        relievers_sorted = sorted(
            reliever_order, key=lambda pin: (-reliever_counts[pin], reliever_order.index(pin))
        )
        results.append(
            TeamLineupOut(
                team_id=team_id,
                games=len(games_for_team),
                unknown_hand_games=unknown_hand_games,
                vs_rhp=_modal_lineup(vs_rhp_games),
                vs_lhp=_modal_lineup(vs_lhp_games),
                rotation=[
                    LineupPitcherOut(pin=pin, player_id=rotation_player[pin], games=rotation_counts[pin])
                    for pin in rotation_order
                ],
                relievers=[
                    LineupPitcherOut(pin=pin, player_id=reliever_player[pin], games=reliever_counts[pin])
                    for pin in relievers_sorted
                ],
            )
        )
    return results
