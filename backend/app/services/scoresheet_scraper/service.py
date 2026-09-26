"""
Scoresheet.com scraper service: fetch and persist league data.

Handles:
- Async HTTP fetching with concurrency lock
- DB persistence for leagues, teams, and rosters

Note: In-memory cache (_league_cache) and cache management functions
(refresh_league_cache, get_cached_leagues) live in __init__.py so that
the module-level state is accessible as `app.services.scoresheet_scraper._league_cache`.
"""

import asyncio
import logging
from datetime import date

import httpx
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    DraftSchedule,
    GameLineup,
    League,
    Player,
    PlayerRoster,
    RosterStatus,
    Team,
)

from .draft_parser import parse_transactions_js
from .lineup_parser import ScrapedGame, parse_score_it_js
from .parser import (
    ScrapedLeague,
    ScrapedRoster,
    ScrapedTeam,
    _DATA_PATH_RE,
    derive_league_type,
    parse_league_js,
    parse_league_list_html,
    parse_league_rosters_js,
)
from .roster_replay import apply_roster_events

logger = logging.getLogger(__name__)

# DEPLOY: SCORESHEET_BASE_URL is configurable via env var. To route through
# an egress proxy, either set HTTPS_PROXY (httpx picks it up automatically)
# or point SCORESHEET_BASE_URL at a reverse proxy that allowlists scoresheet.com.
SCORESHEET_BASE_URL = settings.SCORESHEET_BASE_URL
LEAGUE_LIST_URL = f"{SCORESHEET_BASE_URL}/BB_LeagueList.php"
REQUEST_TIMEOUT = 15.0

# Concurrency lock: only one outbound scrape runs at a time to avoid
# hammering scoresheet.com when multiple requests arrive simultaneously.
_scrape_lock = asyncio.Lock()


# ---------------------------------------------------------------------------
# Async fetch wrappers
# ---------------------------------------------------------------------------


async def fetch_league_list(client: httpx.AsyncClient) -> list[ScrapedLeague]:
    """Fetch and parse the Scoresheet league list page."""
    response = await client.get(LEAGUE_LIST_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return parse_league_list_html(response.text)


async def fetch_league_teams(
    client: httpx.AsyncClient, data_path: str
) -> list[ScrapedTeam]:
    """
    Fetch and parse team owner names for a specific league.

    Args:
        client: httpx async client
        data_path: validated path like "FOR_WWW1/AL_Catfish_Hunter"

    Raises:
        ValueError: if data_path fails validation (path traversal prevention)
        httpx.HTTPStatusError: if the JS file request fails
    """
    if not _DATA_PATH_RE.match(data_path):
        raise ValueError(
            f"Invalid data_path '{data_path}': "
            "must match ^[A-Za-z0-9_]+/[A-Za-z0-9_]+$"
        )

    async with _scrape_lock:
        url = f"{SCORESHEET_BASE_URL}/{data_path}.js"
        response = await client.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return parse_league_js(response.text)


# ---------------------------------------------------------------------------
# DB persistence helpers
# ---------------------------------------------------------------------------


async def persist_league_and_teams(
    session: AsyncSession,
    league_name: str,
    data_path: str,
    teams: list[ScrapedTeam],
    season: int,
) -> League:
    """
    Upsert a league and its 10 teams into the database.

    - Upserts league by name (unique natural key), sets scoresheet_data_path + season + league_type
    - Upserts teams by (league_id, scoresheet_id), name = "Team #N (owner_name)"
    - Returns the League ORM object

    Follows the upsert pattern from seed_league.py and import_teams.py.
    """
    # Derive league type (None if name doesn't follow known pattern)
    try:
        league_type: str | None = derive_league_type(league_name)
    except ValueError:
        logger.warning("Could not derive league type from name: %r", league_name)
        league_type = None

    # Upsert league
    league_stmt = insert(League.__table__).values(
        name=league_name,
        season=season,
        scoresheet_data_path=data_path,
        league_type=league_type,
    )
    league_stmt = league_stmt.on_conflict_do_update(
        index_elements=["name"],
        set_={
            "season": league_stmt.excluded.season,
            "scoresheet_data_path": league_stmt.excluded.scoresheet_data_path,
            "league_type": league_stmt.excluded.league_type,
        },
    )
    await session.execute(league_stmt)
    await session.flush()

    # Fetch the upserted league record
    result = await session.execute(select(League).where(League.name == league_name))
    league = result.scalar_one()

    # Upsert teams
    if teams:
        team_rows = [
            {
                "league_id": league.id,
                "scoresheet_id": team.scoresheet_id,
                "name": f"Team #{team.scoresheet_id} ({team.owner_name})",
            }
            for team in teams
        ]
        team_stmt = insert(Team.__table__).values(team_rows)
        team_stmt = team_stmt.on_conflict_do_update(
            index_elements=["league_id", "scoresheet_id"],
            set_={"name": team_stmt.excluded.name},
        )
        await session.execute(team_stmt)

    await session.commit()
    return league


async def resolve_pins_to_player_ids(
    session: AsyncSession, league: League, pins: set[int]
) -> dict[int, int]:
    """
    Map Scoresheet pins to Player ids for a league.

    AL/BL leagues key players by ``scoresheet_id``; NL leagues by
    ``scoresheet_nl_id``. Pins with no matching player are logged as a
    warning and omitted from the result.
    """
    pin_to_player_id: dict[int, int] = {}
    if not pins:
        return pin_to_player_id

    use_nl = league.league_type == "NL"
    pin_column = Player.scoresheet_nl_id if use_nl else Player.scoresheet_id
    players_result = await session.execute(
        select(Player).where(pin_column.in_(list(pins)))
    )
    for player in players_result.scalars().all():
        pin = player.scoresheet_nl_id if use_nl else player.scoresheet_id
        if pin is not None:
            pin_to_player_id[pin] = player.id

    unresolved = sorted(pins - set(pin_to_player_id.keys()))
    if unresolved:
        logger.warning(
            "League %r: %d unresolved pins (not found in players table): %s%s",
            league.name,
            len(unresolved),
            unresolved[:20],
            "..." if len(unresolved) > 20 else "",
        )
    return pin_to_player_id


def _replay_roster_events_onto(
    pin_rosters: list[ScrapedRoster],
    trans_js: str | None,
    league_name: str,
) -> list[ScrapedRoster]:
    """Apply -T.js roster events on top of pin-based rosters.

    Returns a fresh list of ScrapedRoster reflecting the live state. If
    ``trans_js`` is None (404 or fetch skipped) the input is returned as-is.
    """
    if trans_js is None:
        return pin_rosters

    parsed = parse_transactions_js(trans_js)
    if not parsed.roster_events:
        return pin_rosters

    base = {r.scoresheet_id: set(r.pins) for r in pin_rosters}
    replayed, warnings = apply_roster_events(base, parsed.roster_events)
    if warnings:
        logger.warning(
            "League %r: roster replay produced %d warnings", league_name, len(warnings)
        )

    return [
        ScrapedRoster(scoresheet_id=ssid, pins=sorted(replayed.get(ssid, set())))
        for ssid in sorted(replayed.keys())
    ]


async def scrape_and_persist_rosters(session: AsyncSession, league: League) -> dict:
    """
    Fetch league JS, parse rosters, and persist to player_roster table.

    Validates that the league has scoresheet_data_path and league_type set.
    Looks up players via scoresheet_id (AL/BL) or scoresheet_nl_id (NL).
    Replaces all existing roster rows for the league's teams.

    Returns a summary dict with keys:
        teams_processed, players_added, players_removed, unresolved_pins

    Raises:
        ValueError: if league is missing required fields or JS parsing fails
        httpx.HTTPStatusError: if the upstream JS fetch fails
        httpx.RequestError: on network errors
    """
    if not league.scoresheet_data_path:
        raise ValueError("League has no scoresheet_data_path set")
    if not league.league_type:
        raise ValueError("League has no league_type set")
    if not _DATA_PATH_RE.match(league.scoresheet_data_path):
        raise ValueError(
            f"Invalid scoresheet_data_path '{league.scoresheet_data_path}'"
        )

    # 1. Fetch league JS and -T.js (under concurrency lock).
    # The transactions file holds in-season trades/drops/adds that Scoresheet
    # does NOT propagate back into the league JS's pins[] after the draft
    # freezes; we replay them on top of pins to recover the live roster.
    async with _scrape_lock:
        base_url = f"{SCORESHEET_BASE_URL}/{league.scoresheet_data_path}"
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}.js", timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            js_content = response.text

            trans_js: str | None = None
            try:
                trans_response = await client.get(
                    f"{base_url}-T.js", timeout=REQUEST_TIMEOUT
                )
                trans_response.raise_for_status()
                trans_js = trans_response.text
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    logger.info(
                        "League %r: no -T.js (404); skipping roster event replay",
                        league.name,
                    )
                else:
                    raise

    # 2. Parse rosters from pins, then replay -T.js roster events on top.
    pin_rosters = parse_league_rosters_js(js_content)
    scraped_rosters = _replay_roster_events_onto(pin_rosters, trans_js, league.name)

    # 3. Look up teams in this league -> {scoresheet_id: team.id}
    teams_result = await session.execute(
        select(Team).where(Team.league_id == league.id)
    )
    teams = teams_result.scalars().all()
    team_map = {t.scoresheet_id: t.id for t in teams}
    team_ids = [t.id for t in teams]

    # 4. Collect all unique pins across all rosters
    all_pins: set[int] = set()
    for roster in scraped_rosters:
        all_pins.update(roster.pins)

    # 5. Look up Players by pin -> {pin: player.id}
    pin_to_player_id = await resolve_pins_to_player_ids(session, league, all_pins)
    unresolved_pins = len(all_pins - set(pin_to_player_id.keys()))

    # 6. Get existing roster rows for diff computation
    old_pairs: set[tuple[int, int]] = set()
    if team_ids:
        existing_result = await session.execute(
            select(PlayerRoster).where(PlayerRoster.team_id.in_(team_ids))
        )
        for row in existing_result.scalars().all():
            old_pairs.add((row.player_id, row.team_id))

    # 7. Build new roster (player_id, team_id) pairs
    today = date.today()
    new_roster_objects: list[PlayerRoster] = []
    new_pairs: set[tuple[int, int]] = set()

    for scraped in scraped_rosters:
        team_db_id = team_map.get(scraped.scoresheet_id)
        if team_db_id is None:
            logger.warning(
                "League %r: no team found for scoresheet_id=%d, skipping",
                league.name,
                scraped.scoresheet_id,
            )
            continue

        for pin in scraped.pins:
            player_db_id = pin_to_player_id.get(pin)
            if player_db_id is None:
                continue  # already counted in unresolved_pins

            pair = (player_db_id, team_db_id)
            if pair not in new_pairs:  # deduplicate (pins may appear multiple times)
                new_pairs.add(pair)
                new_roster_objects.append(
                    PlayerRoster(
                        player_id=player_db_id,
                        team_id=team_db_id,
                        league_id=league.id,
                        status=RosterStatus.ROSTERED,
                        added_date=today,
                        dropped_date=None,
                    )
                )

    # 8. Compute diff for logging
    added_count = len(new_pairs - old_pairs)
    removed_count = len(old_pairs - new_pairs)

    old_player_teams = {pid: tid for pid, tid in old_pairs}
    new_player_teams = {pid: tid for pid, tid in new_pairs}
    traded_count = sum(
        1
        for pid in old_player_teams
        if pid in new_player_teams and old_player_teams[pid] != new_player_teams[pid]
    )

    logger.info(
        "League %r: +%d added, -%d removed, %d traded",
        league.name,
        added_count,
        removed_count,
        traded_count,
    )

    # 9. Delete all existing roster rows for this league's teams
    if team_ids:
        await session.execute(
            delete(PlayerRoster).where(PlayerRoster.team_id.in_(team_ids))
        )

    # 10. Insert new roster rows
    if new_roster_objects:
        session.add_all(new_roster_objects)

    # 11. Re-roster players from completed draft picks not in Scoresheet pins yet.
    # Diff by player_id (not pair) so that a player traded after the draft —
    # whose draft_schedule still records the original drafter — does not get
    # re-inserted onto the original team alongside the current owner.
    # Upsert on (league_id, player_id) is a defense-in-depth backstop in case
    # the diff logic ever drifts; the unique constraint enforces it at the DB.
    draft_rostered = await session.execute(
        select(DraftSchedule.picked_player_id, DraftSchedule.team_id).where(
            DraftSchedule.league_id == league.id,
            DraftSchedule.picked_player_id.isnot(None),
        )
    )
    draft_pairs = {(row[0], row[1]) for row in draft_rostered.all()}
    new_player_ids = {pid for pid, _ in new_pairs}
    for player_id, team_id in draft_pairs:
        if player_id in new_player_ids:
            continue
        stmt = insert(PlayerRoster.__table__).values(
            player_id=player_id,
            team_id=team_id,
            league_id=league.id,
            status=RosterStatus.ROSTERED,
            added_date=today,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["league_id", "player_id"],
            set_={
                "team_id": team_id,
                "status": RosterStatus.ROSTERED,
                "added_date": today,
            },
        )
        await session.execute(stmt)

    await session.commit()

    return {
        "teams_processed": len(team_map),
        "players_added": added_count,
        "players_removed": removed_count,
        "unresolved_pins": unresolved_pins,
    }


# ---------------------------------------------------------------------------
# Score-It lineups
# ---------------------------------------------------------------------------


def score_it_url(data_path: str) -> str:
    """
    URL of the Score-It game file for a league.

    Mirrors the rule in Scoresheet's Score-It.htm: swap ``/FOR_WWW1/`` for
    ``/FOR_WWW2/`` and prefix the league name with ``AG_``. Other directories
    (e.g. ``CWWW``) are left as-is.
    """
    dir_part, _, name = data_path.rpartition("/")
    if dir_part == "FOR_WWW1":
        dir_part = "FOR_WWW2"
    return f"{SCORESHEET_BASE_URL}/{dir_part}/AG_{name}.js"


def _empty_lineup_summary() -> dict:
    return {
        "week_end": None,
        "games": 0,
        "rows_written": 0,
        "unresolved_pins": 0,
        "unassigned_subs": 0,
    }


def _build_lineup_rows(
    league: League,
    week_end: date,
    games: list[ScrapedGame],
    team_map: dict[int, int],
    pin_to_player_id: dict[int, int],
    roster_team_by_player: dict[int, int],
) -> tuple[list[GameLineup], int]:
    """
    Turn parsed games into GameLineup rows.

    Starters are attributed to their side directly. Substitution tokens in the
    play string carry no side, so they are attributed via the player's current
    roster team; subs that cannot be attributed are counted and dropped.
    Returns (rows, unassigned_sub_count).
    """
    rows: list[GameLineup] = []
    unassigned_subs = 0

    for game in games:
        visitor_team = team_map.get(game.visitor_idx + 1)
        home_team = team_map.get(game.home_idx + 1)
        if visitor_team is None or home_team is None:
            logger.warning(
                "League %r: game %d references unknown team index (%d or %d); skipping",
                league.name,
                game.game_no,
                game.visitor_idx,
                game.home_idx,
            )
            continue

        seq_by_team = {visitor_team: 0, home_team: 0}
        sides = (
            (visitor_team, home_team, False, game.visitor_lineup),
            (home_team, visitor_team, True, game.home_lineup),
        )

        def _append(team_id: int, opponent_id: int, is_home: bool, entry, is_starter: bool):
            rows.append(
                GameLineup(
                    league_id=league.id,
                    week_end=week_end,
                    game_no=game.game_no,
                    team_id=team_id,
                    opponent_team_id=opponent_id,
                    is_home=is_home,
                    seq=seq_by_team[team_id],
                    slot=entry.slot,
                    position_code=entry.position_code,
                    pin=entry.pin,
                    player_id=pin_to_player_id.get(entry.pin),
                    is_starter=is_starter,
                )
            )
            seq_by_team[team_id] += 1

        for team_id, opponent_id, is_home, lineup in sides:
            for entry in lineup:
                _append(team_id, opponent_id, is_home, entry, is_starter=True)

        for entry in game.substitutions:
            player_id = pin_to_player_id.get(entry.pin)
            sub_team = roster_team_by_player.get(player_id) if player_id else None
            if sub_team == visitor_team:
                _append(visitor_team, home_team, False, entry, is_starter=False)
            elif sub_team == home_team:
                _append(home_team, visitor_team, True, entry, is_starter=False)
            else:
                unassigned_subs += 1

    return rows, unassigned_subs


async def scrape_and_persist_lineups(session: AsyncSession, league: League) -> dict:
    """
    Fetch the league's Score-It game file and persist starting lineups.

    Replaces game_lineups rows for the (league, week_end) the file covers;
    earlier weeks are left in place. A 404 (league has no Score-It file yet)
    is not an error and returns an empty summary.

    Returns a summary dict with keys:
        week_end (ISO string or None), games, rows_written,
        unresolved_pins, unassigned_subs

    Raises:
        ValueError: if league is missing required fields or the file has no date
        httpx.HTTPStatusError: on non-404 upstream errors
        httpx.RequestError: on network errors
    """
    if not league.scoresheet_data_path:
        raise ValueError("League has no scoresheet_data_path set")
    if not _DATA_PATH_RE.match(league.scoresheet_data_path):
        raise ValueError(
            f"Invalid scoresheet_data_path '{league.scoresheet_data_path}'"
        )

    url = score_it_url(league.scoresheet_data_path)
    async with _scrape_lock:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, timeout=REQUEST_TIMEOUT)
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    logger.info(
                        "League %r: no Score-It file (404 at %s); skipping lineups",
                        league.name,
                        url,
                    )
                    return _empty_lineup_summary()
                raise
            js_content = response.text

    parsed = parse_score_it_js(js_content)
    if parsed.thru_date is None:
        raise ValueError("Score-It file has no thru_date_; cannot determine week")
    if not parsed.games:
        logger.warning(
            "League %r: Score-It file for week ending %s had no parseable games",
            league.name,
            parsed.thru_date,
        )
        summary = _empty_lineup_summary()
        summary["week_end"] = parsed.thru_date.isoformat()
        return summary

    teams_result = await session.execute(select(Team).where(Team.league_id == league.id))
    team_map = {t.scoresheet_id: t.id for t in teams_result.scalars().all()}

    all_pins: set[int] = set()
    for game in parsed.games:
        all_pins.update(e.pin for e in game.visitor_lineup)
        all_pins.update(e.pin for e in game.home_lineup)
        all_pins.update(e.pin for e in game.substitutions)
    pin_to_player_id = await resolve_pins_to_player_ids(session, league, all_pins)

    roster_result = await session.execute(
        select(PlayerRoster.player_id, PlayerRoster.team_id).where(
            PlayerRoster.league_id == league.id
        )
    )
    roster_team_by_player = {pid: tid for pid, tid in roster_result.all()}

    rows, unassigned_subs = _build_lineup_rows(
        league, parsed.thru_date, parsed.games, team_map, pin_to_player_id, roster_team_by_player
    )

    await session.execute(
        delete(GameLineup).where(
            GameLineup.league_id == league.id,
            GameLineup.week_end == parsed.thru_date,
        )
    )
    if rows:
        session.add_all(rows)
    await session.commit()

    logger.info(
        "League %r: lineups for week ending %s: %d games, %d rows, %d unassigned subs",
        league.name,
        parsed.thru_date,
        len(parsed.games),
        len(rows),
        unassigned_subs,
    )
    return {
        "week_end": parsed.thru_date.isoformat(),
        "games": len(parsed.games),
        "rows_written": len(rows),
        "unresolved_pins": len(all_pins - set(pin_to_player_id.keys())),
        "unassigned_subs": unassigned_subs,
    }
