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
from app.models import DraftSchedule, League, Player, PlayerRoster, RosterStatus, Team

from .parser import (
    ScrapedLeague,
    ScrapedTeam,
    _DATA_PATH_RE,
    derive_league_type,
    parse_league_js,
    parse_league_list_html,
    parse_league_rosters_js,
)

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

    # 1. Fetch JS (under concurrency lock)
    async with _scrape_lock:
        url = f"{SCORESHEET_BASE_URL}/{league.scoresheet_data_path}.js"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            js_content = response.text

    # 2. Parse rosters
    scraped_rosters = parse_league_rosters_js(js_content)

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
    pin_to_player_id: dict[int, int] = {}
    if all_pins:
        use_nl = league.league_type == "NL"
        if use_nl:
            players_result = await session.execute(
                select(Player).where(Player.scoresheet_nl_id.in_(list(all_pins)))
            )
        else:
            players_result = await session.execute(
                select(Player).where(Player.scoresheet_id.in_(list(all_pins)))
            )
        for player in players_result.scalars().all():
            pin = player.scoresheet_nl_id if use_nl else player.scoresheet_id
            if pin is not None:
                pin_to_player_id[pin] = player.id

    unresolved_pins = len(all_pins - set(pin_to_player_id.keys()))
    if unresolved_pins:
        unresolved = sorted(all_pins - set(pin_to_player_id.keys()))
        logger.warning(
            "League %r: %d unresolved pins (not found in players table): %s%s",
            league.name,
            unresolved_pins,
            unresolved[:20],
            "..." if unresolved_pins > 20 else "",
        )

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
