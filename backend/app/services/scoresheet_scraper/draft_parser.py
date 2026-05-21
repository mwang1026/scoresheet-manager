"""
Pure parsing functions for Scoresheet.com draft data.

No I/O — all functions operate on strings and return data structures.
Safety-critical: uses regex only, never eval/exec.

Parses two JS sources:
  1. League JS ({data_path}.js) — draft config: schedule params, pick order,
     omit/extra pick trades
  2. Transactions JS ({data_path}-T.js) — completed picks via p() calls
"""

import logging
import math
import re
from datetime import datetime, timezone

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

_PICKS_SCHED_RE = re.compile(r"picks_sched\s*:\s*\{([^}]+)\}")
_T1A_ODD_RE = re.compile(r"t1a_odd_r1\s*:\s*\[([^\]]+)\]")
_T1A_EVEN_RE = re.compile(r"t1a_even_r1\s*:\s*\[([^\]]+)\]")
_ROSTERS_BLOCK_RE = re.compile(r"rosters\s*:\s*\[", re.DOTALL)
_OMIT_R1S_RE = re.compile(r"omit_r1s\s*:\s*\[([^\]]*)\]")
_EXTRA_PICKS_RE = re.compile(r"extra_picks\s*:\s*\[([^\]]*)\]")
_EXTRA_PICK_OBJ_RE = re.compile(r"\{[^}]*f1\s*:\s*(\d+)[^}]*r1\s*:\s*(\d+)[^}]*\}")
_N_PICKS_DONE_RE = re.compile(r"n_picks_done\s*:\s*(\d+)")
_ROUND1_FIELD_RE = re.compile(r"round1_\s*:\s*(\d+)")

# Transaction JS patterns
_PICK_RE = re.compile(r"^p\((\d+),(\d+)(?:,(\d+))?\);", re.MULTILINE)
_ROUND_MARKER_RE = re.compile(r"^round1_=(\d+);", re.MULTILINE)
# Roster event: r(month, day, team_a, team_b, [players_from_a], [players_from_b], ...)
# Months are 0-indexed (matches JS Date), days are 1-indexed. Captures the first
# two bracket arrays (always integer player lists); ignores trailing pick-trade
# arrays which contain {f1:..,r1:..} objects and are not roster-relevant.
_ROSTER_EVENT_RE = re.compile(
    r"^r\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,"
    r"\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]",
    re.MULTILINE,
)

# Key-value extraction inside picks_sched block
_SCHED_KV_RE = re.compile(r"(\w+)\s*:\s*(-?\d+)")


# ---------------------------------------------------------------------------
# Pydantic data models
# ---------------------------------------------------------------------------


class PicksSchedule(BaseModel):
    """Schedule parameters from lg_.picks_sched."""

    last_pt: int  # Unix seconds of last scheduled pick
    last_r1: int  # Last round in this draft window
    start_r1: int  # First round in this draft window
    n_skips_todo: int  # Net skipped slots (omits - extras in range)
    total_pt: int  # Total time spread (seconds, 17hr active days)


class DraftConfig(BaseModel):
    """Draft configuration parsed from league JS."""

    picks_sched: PicksSchedule | None  # None if no active draft
    t1a_odd_r1: list[int]  # Team order for odd rounds (1-indexed team numbers)
    t1a_even_r1: list[int]  # Team order for even rounds
    omit_r1s: dict[int, list[int]]  # {team_number: [round, ...]}
    extra_picks: dict[int, list[dict]]  # {team_number: [{f1, r1}, ...]}
    n_picks_done: int  # Completed picks count
    round1: int  # Starting round for display
    n_teams: int  # Number of teams (usually 10)


class UpcomingPick(BaseModel):
    """A computed upcoming pick slot."""

    round: int
    pick_in_round: int  # 1-indexed position within round
    team_number: int  # 1-indexed team making the pick
    from_team_number: int | None  # If using a traded pick
    scheduled_at: datetime  # Computed from pick_ms1970


class CompletedPick(BaseModel):
    """A completed pick from -T.js."""

    round: int
    team_number: int  # 1-indexed team who picked
    player_scoresheet_id: int  # SSID (pin)
    from_team_number: int | None  # If using traded pick


class RosterEvent(BaseModel):
    """A roster-altering event from -T.js (trade, FA add, FA drop).

    Scoresheet emits these as r(month, day, team_a, team_b, players_out,
    players_in, [picks_out, picks_in]) lines. team_b == 0 represents the
    free-agent pool, so a "trade" with team_b=0 is a drop and/or pickup.

    Two-team trades are usually emitted as a mirrored pair (team_a/team_b
    swapped with arrays swapped). Callers should dedupe before replay.

    Months are 0-indexed (JS Date convention), days are 1-indexed.
    """

    month: int  # 0-indexed (0=Jan, 11=Dec)
    day: int  # 1-indexed
    team_a: int  # 1-indexed; the "actor" team
    team_b: int  # 1-indexed, or 0 for the FA pool
    players_out: list[int]  # SSIDs leaving team_a (going to team_b or FA)
    players_in: list[int]  # SSIDs joining team_a (from team_b or FA)
    source_order: int  # Position in -T.js, for deterministic ordering


class ParsedTransactions(BaseModel):
    """Parsed result from -T.js."""

    completed_picks: list[CompletedPick]
    final_round1: int  # Last round1_ value (current round marker)
    roster_events: list[RosterEvent]  # Trades, drops, FA pickups (deduped)


# ---------------------------------------------------------------------------
# Pick timing algorithm (ported from sport-etc.min.js)
# ---------------------------------------------------------------------------


def _pt_minus_gaps(t: int) -> float:
    """Remove 7hr overnight gaps from timestamp for linear interpolation."""
    return t - 25200 * math.floor((t - 43200) / 86400)


def _pt_plus_gaps(t: float) -> float:
    """Re-add overnight gaps after linear interpolation."""
    return t + 25200 * math.floor((t - 43200) / 61200)


def pick_ms1970(pick_index: int, sched: PicksSchedule, n_teams: int) -> int:
    """Compute pick time in milliseconds since epoch.

    Ports the pick_ms1970() function from picks.out.js.
    pick_index is 0-based relative to the start of the full draft
    (including prior rounds not in this window).
    """
    total_slots = sched.last_r1 * n_teams
    if total_slots == 0:
        return sched.last_pt * 1000

    progress = min((pick_index + 1) / total_slots, 1.0)
    return int(
        1000
        * _pt_plus_gaps(
            _pt_minus_gaps(sched.last_pt)
            - (17 / 24) * sched.total_pt * (1 - progress)
        )
    )


# ---------------------------------------------------------------------------
# Parsing functions
# ---------------------------------------------------------------------------


def _parse_int_list(s: str) -> list[int]:
    """Parse a comma-separated string of integers."""
    return [int(x.strip()) for x in s.split(",") if x.strip().lstrip("-").isdigit()]


def _extract_roster_blocks(js_content: str) -> list[str]:
    """Extract individual roster object blocks from the rosters array.

    Handles nested braces within each roster entry.
    """
    m = _ROSTERS_BLOCK_RE.search(js_content)
    if not m:
        return []

    # Find the matching close bracket for the rosters array
    start = m.end()
    depth = 1
    pos = start
    while pos < len(js_content) and depth > 0:
        if js_content[pos] == "[":
            depth += 1
        elif js_content[pos] == "]":
            depth -= 1
        pos += 1

    rosters_body = js_content[start : pos - 1]

    # Split into individual roster blocks by matching braces
    blocks = []
    i = 0
    while i < len(rosters_body):
        if rosters_body[i] == "{":
            depth = 1
            j = i + 1
            while j < len(rosters_body) and depth > 0:
                if rosters_body[j] == "{":
                    depth += 1
                elif rosters_body[j] == "}":
                    depth -= 1
                j += 1
            blocks.append(rosters_body[i:j])
            i = j
        else:
            i += 1

    return blocks


def parse_draft_config(js_content: str) -> DraftConfig:
    """Parse draft configuration from league JS content.

    Extracts picks_sched, team draft order, omit_r1s, and extra_picks
    from the same JS file that parser.py already handles for rosters.
    """
    # Parse picks_sched (optional — absent when no active draft)
    picks_sched: PicksSchedule | None = None
    sched_match = _PICKS_SCHED_RE.search(js_content)
    if sched_match:
        kvs = dict(_SCHED_KV_RE.findall(sched_match.group(1)))
        required = {"last_pt", "last_r1", "start_r1", "n_skips_todo", "total_pt"}
        if required.issubset(kvs.keys()):
            picks_sched = PicksSchedule(
                last_pt=int(kvs["last_pt"]),
                last_r1=int(kvs["last_r1"]),
                start_r1=int(kvs["start_r1"]),
                n_skips_todo=int(kvs["n_skips_todo"]),
                total_pt=int(kvs["total_pt"]),
            )

    # Parse team draft order
    odd_match = _T1A_ODD_RE.search(js_content)
    even_match = _T1A_EVEN_RE.search(js_content)
    if not odd_match or not even_match:
        raise ValueError("Missing t1a_odd_r1 or t1a_even_r1 in league JS")

    t1a_odd_r1 = _parse_int_list(odd_match.group(1))
    t1a_even_r1 = _parse_int_list(even_match.group(1))
    n_teams = len(t1a_odd_r1)

    if n_teams == 0:
        raise ValueError("t1a_odd_r1 is empty")
    if len(t1a_even_r1) != n_teams:
        raise ValueError(
            f"t1a_odd_r1 ({n_teams}) and t1a_even_r1 ({len(t1a_even_r1)}) "
            "have different lengths"
        )

    # Parse omit_r1s and extra_picks from roster blocks
    omit_r1s: dict[int, list[int]] = {}
    extra_picks: dict[int, list[dict]] = {}

    roster_blocks = _extract_roster_blocks(js_content)
    for i, block in enumerate(roster_blocks):
        team_num = i + 1  # 1-indexed

        # Parse omit_r1s
        omit_match = _OMIT_R1S_RE.search(block)
        if omit_match and omit_match.group(1).strip():
            rounds = _parse_int_list(omit_match.group(1))
            if rounds:
                omit_r1s[team_num] = rounds

        # Parse extra_picks
        extras_match = _EXTRA_PICKS_RE.search(block)
        if extras_match:
            for ep_match in _EXTRA_PICK_OBJ_RE.finditer(extras_match.group(1)):
                pick = {"f1": int(ep_match.group(1)), "r1": int(ep_match.group(2))}
                extra_picks.setdefault(team_num, []).append(pick)

    # Parse n_picks_done (optional, defaults to 0)
    n_picks_done = 0
    npd_match = _N_PICKS_DONE_RE.search(js_content)
    if npd_match:
        n_picks_done = int(npd_match.group(1))

    # Parse round1_ (starting round for display)
    round1 = 1
    r1_match = _ROUND1_FIELD_RE.search(js_content)
    if r1_match:
        round1 = int(r1_match.group(1))

    return DraftConfig(
        picks_sched=picks_sched,
        t1a_odd_r1=t1a_odd_r1,
        t1a_even_r1=t1a_even_r1,
        omit_r1s=omit_r1s,
        extra_picks=extra_picks,
        n_picks_done=n_picks_done,
        round1=round1,
        n_teams=n_teams,
    )


def parse_transactions_js(js_content: str) -> ParsedTransactions:
    """Parse -T.js for completed picks, round markers, and roster events.

    Tracks round1_ updates to assign rounds to picks.
    Parses r() lines as RosterEvents (trades, FA drops, FA pickups), deduped
    so mirrored pairs collapse to one event.
    Ignores m() (messages) and pm() (public messages).
    """
    completed_picks: list[CompletedPick] = []
    current_round = 1

    # Build a list of all events sorted by position in the file
    events: list[tuple[int, str, re.Match]] = []

    for m in _ROUND_MARKER_RE.finditer(js_content):
        events.append((m.start(), "round", m))

    for m in _PICK_RE.finditer(js_content):
        events.append((m.start(), "pick", m))

    events.sort(key=lambda e: e[0])

    for _pos, event_type, match in events:
        if event_type == "round":
            current_round = int(match.group(1))
        elif event_type == "pick":
            team_number = int(match.group(1))
            player_ssid = int(match.group(2))
            from_team = int(match.group(3)) if match.group(3) else None
            # SSID=0 is Scoresheet's sentinel for a passed/skipped pick —
            # the slot exists in -T.js but no player was actually selected.
            # Drop these so downstream code never tries to resolve them.
            if player_ssid <= 0:
                continue
            completed_picks.append(
                CompletedPick(
                    round=current_round,
                    team_number=team_number,
                    player_scoresheet_id=player_ssid,
                    from_team_number=from_team,
                )
            )

    roster_events = _parse_roster_events(js_content)

    return ParsedTransactions(
        completed_picks=completed_picks,
        final_round1=current_round,
        roster_events=roster_events,
    )


def _parse_roster_events(js_content: str) -> list[RosterEvent]:
    """Extract r() lines from -T.js as deduped, chronologically ordered events.

    Mirrored pairs (team_a/team_b swapped, arrays swapped) collapse to a single
    RosterEvent keyed by (month, day, canonical_team_pair, canonical_player_set).
    Picks-only trades (both player arrays empty) are dropped — they don't change
    roster ownership.
    """
    seen: dict[tuple[int, int, tuple[int, int], frozenset[int]], RosterEvent] = {}

    for idx, m in enumerate(_ROSTER_EVENT_RE.finditer(js_content)):
        month = int(m.group(1))
        day = int(m.group(2))
        team_a = int(m.group(3))
        team_b = int(m.group(4))
        players_out = _parse_int_list(m.group(5))
        players_in = _parse_int_list(m.group(6))

        if not players_out and not players_in:
            # Picks-only trade — no roster impact.
            continue

        # Canonical key for dedup: order the team pair and combine all players.
        canonical_pair = (min(team_a, team_b), max(team_a, team_b))
        canonical_players = frozenset(players_out) | frozenset(players_in)
        key = (month, day, canonical_pair, canonical_players)

        if key in seen:
            # Mirror — keep the first (lower source_order). For FA events
            # (team_b == 0) the canonical pair already includes 0, and unpaired
            # records simply don't have a mirror to collide with.
            continue

        seen[key] = RosterEvent(
            month=month,
            day=day,
            team_a=team_a,
            team_b=team_b,
            players_out=players_out,
            players_in=players_in,
            source_order=idx,
        )

    # Chronological order; source_order breaks ties when same (month, day).
    return sorted(seen.values(), key=lambda e: (e.month, e.day, e.source_order))


def compute_upcoming_picks(config: DraftConfig) -> list[UpcomingPick]:
    """Compute all upcoming pick slots with scheduled times.

    Iterates through rounds from start_r1 to last_r1, applying the draft
    order (odd/even alternation), omit_r1s, and extra_picks to build the
    complete schedule. Uses pick_ms1970() for timing.

    Returns picks ordered by scheduled time.
    """
    if config.picks_sched is None:
        return []

    sched = config.picks_sched
    n_teams = config.n_teams
    picks: list[UpcomingPick] = []

    # pick_index tracks the time slot position, starting from the beginning
    # of the full draft (including prior rounds not in this window)
    # n_skips_todo accounts for omitted slots across the entire range
    pick_index = (sched.start_r1 - 1) * n_teams + sched.n_skips_todo

    for rnd in range(sched.start_r1, sched.last_r1 + 1):
        order = config.t1a_odd_r1 if rnd % 2 == 1 else config.t1a_even_r1
        pick_in_round = 0

        for team_num in order:
            # Check if this team has this round omitted (traded away)
            if team_num in config.omit_r1s and rnd in config.omit_r1s[team_num]:
                # Find who has the extra_pick for {f1: team_num, r1: rnd}
                assigned = False
                for buyer_team, buyer_extras in config.extra_picks.items():
                    for ep in buyer_extras:
                        if ep["f1"] == team_num and ep["r1"] == rnd:
                            # This slot is reassigned to buyer_team
                            pick_in_round += 1
                            scheduled_at = datetime.fromtimestamp(
                                pick_ms1970(pick_index, sched, n_teams) / 1000,
                                tz=timezone.utc,
                            )
                            picks.append(
                                UpcomingPick(
                                    round=rnd,
                                    pick_in_round=pick_in_round,
                                    team_number=buyer_team,
                                    from_team_number=team_num,
                                    scheduled_at=scheduled_at,
                                )
                            )
                            pick_index += 1
                            assigned = True
                            break
                    if assigned:
                        break

                if not assigned:
                    # Skipped slot — no team picking, don't increment pick_index
                    pass
                continue

            pick_in_round += 1
            scheduled_at = datetime.fromtimestamp(
                pick_ms1970(pick_index, sched, n_teams) / 1000,
                tz=timezone.utc,
            )
            picks.append(
                UpcomingPick(
                    round=rnd,
                    pick_in_round=pick_in_round,
                    team_number=team_num,
                    from_team_number=None,
                    scheduled_at=scheduled_at,
                )
            )
            pick_index += 1

    return picks
