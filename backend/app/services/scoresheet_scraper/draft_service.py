"""
Draft scraper service: fetch, parse, and persist draft schedule data.

Handles:
- Fetching league JS + transactions JS from Scoresheet.com
- Parsing draft config and completed picks
- Computing upcoming pick schedule with times
- Persisting DraftSchedule rows and rostering completed picks
- Rate limiting via in-memory cooldowns
"""

import asyncio
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import and_, delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DraftSchedule, League, Player, Team

from .draft_parser import (
    DraftConfig,
    ParsedTransactions,
    UpcomingPick,
    compute_upcoming_picks,
    parse_draft_config,
    parse_transactions_js,
)
from .parser import _DATA_PATH_RE
from .service import REQUEST_TIMEOUT, SCORESHEET_BASE_URL

logger = logging.getLogger(__name__)

# In-memory cooldown: {league_id: last_scrape_utc}
# Resets on process restart — acceptable for this use case.
_draft_cooldowns: dict[int, datetime] = {}

# Separate lock from roster scraper so they don't block each other.
_draft_scrape_lock = asyncio.Lock()

COOLDOWN_SECONDS = 30 * 60  # 30 minutes
BACKOFF_DELAYS = [30, 120]  # Exponential backoff on 429/5xx


async def _fetch_with_backoff(
    client: httpx.AsyncClient, url: str
) -> httpx.Response:
    """Fetch URL with exponential backoff on 429/5xx."""
    last_exc: Exception | None = None
    for attempt, delay in enumerate([0] + BACKOFF_DELAYS):
        if delay:
            logger.info("Backoff: waiting %ds before retry %d for %s", delay, attempt, url)
            await asyncio.sleep(delay)
        try:
            response = await client.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 500, 502, 503, 504):
                last_exc = e
                logger.warning(
                    "HTTP %d fetching %s (attempt %d)",
                    e.response.status_code,
                    url,
                    attempt + 1,
                )
                continue
            raise
    raise last_exc  # type: ignore[misc]


async def _fetch_draft_js(data_path: str) -> tuple[str, str | None]:
    """Fetch league JS and transactions JS under the draft scrape lock.

    Returns (league_js, trans_js). trans_js is None if -T.js returns 404.
    """
    async with _draft_scrape_lock:
        league_url = f"{SCORESHEET_BASE_URL}/{data_path}.js"
        trans_url = f"{SCORESHEET_BASE_URL}/{data_path}-T.js"

        async with httpx.AsyncClient() as client:
            league_response = await _fetch_with_backoff(client, league_url)
            league_js = league_response.text

            try:
                trans_response = await _fetch_with_backoff(client, trans_url)
                trans_js: str | None = trans_response.text
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    trans_js = None
                else:
                    raise

    return league_js, trans_js


async def scrape_and_persist_draft(
    session: AsyncSession,
    league: League,
    *,
    force: bool = False,
) -> dict:
    """Main draft scrape orchestration.

    1. Check cooldown (skip if within 30min, unless force=True)
    2. Fetch league JS + transactions JS under lock
    3. Parse draft config and completed picks
    4. Compute upcoming pick schedule
    5. Upsert DraftSchedule rows (preserving picked_player_id)
    6. Mark completed picks and roster only newly-completed ones
    7. Clean stale upcoming rows outside the current window
    8. Detect draft complete (no upcoming picks + picks_sched is None)
    9. Record cooldown timestamp

    Returns summary dict.
    """
    if not league.scoresheet_data_path:
        raise ValueError("League has no scoresheet_data_path set")
    if not league.league_type:
        raise ValueError("League has no league_type set")
    if not _DATA_PATH_RE.match(league.scoresheet_data_path):
        raise ValueError(f"Invalid scoresheet_data_path '{league.scoresheet_data_path}'")

    # 1. Check cooldown
    now = datetime.now(timezone.utc)
    cooldown_skipped = False
    if not force and league.id in _draft_cooldowns:
        elapsed = (now - _draft_cooldowns[league.id]).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            logger.info(
                "Draft scrape for league %d skipped: %.0fs since last scrape (cooldown %ds)",
                league.id,
                elapsed,
                COOLDOWN_SECONDS,
            )
            return {
                "cooldown_skipped": True,
                "upcoming_picks": 0,
                "completed_picks_processed": 0,
                "players_rostered": 0,
                "unresolved_players": 0,
            }

    # 2. Fetch both JS files under lock
    league_js, trans_js = await _fetch_draft_js(league.scoresheet_data_path)

    # 3. Parse
    config = parse_draft_config(league_js)
    transactions: ParsedTransactions | None = None
    if trans_js is not None:
        transactions = parse_transactions_js(trans_js)

    # 4. Compute upcoming picks
    upcoming = compute_upcoming_picks(config)

    # 5. Build team lookup: {scoresheet_id: team DB row}
    teams_result = await session.execute(
        select(Team).where(Team.league_id == league.id)
    )
    teams = teams_result.scalars().all()
    team_map = {t.scoresheet_id: t for t in teams}

    # 6. Upsert window picks (preserves picked_player_id)
    schedule_dicts = _build_schedule_dicts(upcoming, league.id, team_map)
    if schedule_dicts:
        stmt = insert(DraftSchedule.__table__).values(schedule_dicts)
        stmt = stmt.on_conflict_do_update(
            index_elements=["league_id", "round", "pick_in_round"],
            set_={
                "team_id": stmt.excluded.team_id,
                "from_team_id": stmt.excluded.from_team_id,
                "scheduled_at": stmt.excluded.scheduled_at,
            },
        )
        await session.execute(stmt)

    # 7. Mark completed picks and roster only new ones
    roster_result = await _process_completed_picks(
        session, league, config, transactions, team_map, upcoming
    )

    # 8. Clean stale upcoming rows outside the current window
    if config.picks_sched is None:
        # Draft complete: remove all unmarked rows
        await session.execute(
            delete(DraftSchedule).where(
                DraftSchedule.league_id == league.id,
                DraftSchedule.picked_player_id.is_(None),
            )
        )
    elif schedule_dicts:
        start_r1 = config.picks_sched.start_r1
        last_r1 = config.picks_sched.last_r1
        await session.execute(
            delete(DraftSchedule).where(
                DraftSchedule.league_id == league.id,
                DraftSchedule.picked_player_id.is_(None),
                ~and_(
                    DraftSchedule.round >= start_r1,
                    DraftSchedule.round <= last_r1,
                ),
            )
        )

    # 9. Detect draft complete
    draft_complete = config.picks_sched is None and (
        transactions is not None and len(transactions.completed_picks) > 0
    )
    if league.draft_complete != draft_complete:
        league.draft_complete = draft_complete
        session.add(league)

    await session.commit()

    # 10. Count upcoming (unmarked) picks for response
    upcoming_count_result = await session.execute(
        select(DraftSchedule)
        .where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.is_(None),
        )
    )
    upcoming_count = len(upcoming_count_result.scalars().all())

    # 11. Record cooldown
    _draft_cooldowns[league.id] = datetime.now(timezone.utc)

    return {
        "cooldown_skipped": False,
        "upcoming_picks": upcoming_count,
        "completed_picks_processed": roster_result["completed_picks_processed"],
        "players_rostered": roster_result["players_rostered"],
        "unresolved_players": roster_result["unresolved_players"],
    }


def _build_schedule_dicts(
    upcoming: list[UpcomingPick],
    league_id: int,
    team_map: dict[int, "Team"],
) -> list[dict]:
    """Convert UpcomingPick models to dicts for PostgreSQL upsert."""
    rows = []
    for pick in upcoming:
        team = team_map.get(pick.team_number)
        if team is None:
            logger.warning(
                "Upcoming pick references unknown team_number=%d, skipping",
                pick.team_number,
            )
            continue

        from_team = None
        if pick.from_team_number is not None:
            from_team_obj = team_map.get(pick.from_team_number)
            from_team = from_team_obj.id if from_team_obj else None

        rows.append(
            {
                "league_id": league_id,
                "round": pick.round,
                "pick_in_round": pick.pick_in_round,
                "team_id": team.id,
                "from_team_id": from_team,
                "scheduled_at": pick.scheduled_at,
            }
        )
    return rows


async def _process_completed_picks(
    session: AsyncSession,
    league: League,
    config: DraftConfig,
    transactions: ParsedTransactions | None,
    team_map: dict[int, "Team"],
    upcoming: list[UpcomingPick],
) -> dict:
    """Mark completed picks on schedule rows and roster only newly-completed ones.

    -T.js is the source of truth for who actually picked. We always update
    the matching schedule row's team_id, from_team_id, and picked_player_id
    to match -T.js, even on a re-scrape. The "newly rostered" count tracks
    only picks that weren't yet recorded, so re-scrapes don't double-roster.

    Schedule row matching, in priority order:
      1. (league, round, pick_in_round) from pick_lookup — the normal path
         while picks_sched is active.
      2. (league, round, picked_player_id == resolved_player.id) — the
         repair path for picks that were marked under a divergent projection
         (e.g. compute_upcoming_picks placed the pick on the wrong team).
    """
    from app.services.roster import assign_to_roster

    result = {"completed_picks_processed": 0, "players_rostered": 0, "unresolved_players": 0}

    if transactions is None:
        return result

    # Build lookup: (round, team_number, from_team_number) → pick_in_round
    pick_lookup: dict[tuple[int, int, int | None], int] = {}
    for p in upcoming:
        pick_lookup[(p.round, p.team_number, p.from_team_number)] = p.pick_in_round

    use_nl = league.league_type == "NL"

    for pick in transactions.completed_picks:
        result["completed_picks_processed"] += 1

        # Resolve the team and player up front — needed by both lookup paths
        # and we want a uniform skip reason if either fails.
        team = team_map.get(pick.team_number)
        if team is None:
            logger.warning(
                "Completed pick references unknown team_number=%d", pick.team_number
            )
            result["unresolved_players"] += 1
            continue

        if use_nl:
            player_result = await session.execute(
                select(Player).where(
                    Player.scoresheet_nl_id == pick.player_scoresheet_id
                )
            )
        else:
            player_result = await session.execute(
                select(Player).where(
                    Player.scoresheet_id == pick.player_scoresheet_id
                )
            )
        player = player_result.scalar_one_or_none()

        if player is None:
            logger.warning(
                "Completed pick SSID=%d not found in players table",
                pick.player_scoresheet_id,
            )
            result["unresolved_players"] += 1
            continue

        # Locate the schedule row — projected slot first, fall back to repair
        # by player when the projection diverged from reality.
        sched_row = None
        pick_in_round = pick_lookup.get(
            (pick.round, pick.team_number, pick.from_team_number)
        )
        if pick_in_round is not None:
            sched_result = await session.execute(
                select(DraftSchedule).where(
                    DraftSchedule.league_id == league.id,
                    DraftSchedule.round == pick.round,
                    DraftSchedule.pick_in_round == pick_in_round,
                )
            )
            sched_row = sched_result.scalar_one_or_none()
        if sched_row is None:
            sched_result = await session.execute(
                select(DraftSchedule).where(
                    DraftSchedule.league_id == league.id,
                    DraftSchedule.round == pick.round,
                    DraftSchedule.picked_player_id == player.id,
                )
            )
            sched_row = sched_result.scalar_one_or_none()
        if sched_row is None:
            # Prior-window pick or never-scheduled slot — nothing to mark
            continue

        from_team_id: int | None = None
        if pick.from_team_number is not None:
            from_team = team_map.get(pick.from_team_number)
            from_team_id = from_team.id if from_team else None

        was_unmarked = sched_row.picked_player_id is None

        sched_row.picked_player_id = player.id
        sched_row.team_id = team.id
        sched_row.from_team_id = from_team_id

        if was_unmarked:
            await assign_to_roster(session, player.id, team.id, league.id)
            result["players_rostered"] += 1
            logger.info(
                "Rostered player %d (%s %s) to team %d via draft pick",
                player.id,
                player.first_name,
                player.last_name,
                team.id,
            )

    return result


def get_draft_cooldown(league_id: int) -> datetime | None:
    """Get the last scrape time for a league (for API responses)."""
    return _draft_cooldowns.get(league_id)
