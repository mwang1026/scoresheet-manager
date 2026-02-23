"""
Scoresheet.com scraper service.

Fetches league list and team owner names from scoresheet.com.
- League list: scraped from BB_LeagueList.php (cached in-memory at startup)
- Team names: scraped per-league from per-league JS files (live, not cached)
- Rosters: scraped per-league from per-league JS files, persisted to player_roster

All parsing is done via pure functions (no I/O) for testability.
No eval/exec is used anywhere -- JS data is extracted via regex only.
"""

import asyncio
import logging
import re
from datetime import date

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import League, Player, PlayerRoster, Team

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

# Maps source directory in href -> JS directory for team data
_DIR_MAP = {
    "FOR_WWW": "FOR_WWW1",
    "CWWW": "CWWW",
}

# In-memory cache populated at startup and on refresh
_league_cache: list["ScrapedLeague"] = []

# League name prefixes to strip when deriving league type (longest first)
_LEAGUE_PREFIXES = ["eP-", "wP-", "P-", "e", "w", "a"]

# Compiled regex patterns
_DATA_PATH_RE = re.compile(r"^[A-Za-z0-9_]+/[A-Za-z0-9_]+$")
_HREF_RE = re.compile(r"\.\./(\w+)/(.+)\.htm$", re.IGNORECASE)
_OWNER_ARRAY_RE = re.compile(r"owner\s*:\s*\[([^\]]+)\]", re.DOTALL)
_DOUBLE_QUOTED_RE = re.compile(r'"([^"]*)"')
_SINGLE_QUOTED_RE = re.compile(r"'([^']*)'")
_ROSTERS_ARRAY_RE = re.compile(r"rosters\s*:\s*\[", re.DOTALL)
_PINS_ARRAY_RE = re.compile(r"pins\s*:\s*\[([^\]]*)\]")


# ---------------------------------------------------------------------------
# Pydantic data models
# ---------------------------------------------------------------------------


class ScrapedLeague(BaseModel):
    """A league discovered from the Scoresheet league list page."""

    name: str
    data_path: str  # e.g. "FOR_WWW1/AL_Catfish_Hunter"


class ScrapedTeam(BaseModel):
    """A team scraped from a league JS file."""

    scoresheet_id: int  # 1-indexed position in owner array
    owner_name: str


class ScrapedRoster(BaseModel):
    """A team roster scraped from a league JS file."""

    scoresheet_id: int  # 1-indexed team number (index + 1)
    pins: list[int]  # Scoresheet player IDs for this team


# ---------------------------------------------------------------------------
# Pure parsing functions (no I/O)
# ---------------------------------------------------------------------------


def derive_league_type(league_name: str) -> str:
    """
    Derive the league type (AL, NL, or BL) from a Scoresheet league name.

    Strips known prefixes (eP-, wP-, P-, e, w, a) in longest-first order,
    then checks if the remainder starts with AL, NL, or BL.

    Examples:
        "AL Bleacher Bums" -> "AL"
        "P-NL Hank Aaron"  -> "NL"
        "eP-AL Catfish"    -> "AL"
        "BL Mixed"         -> "BL"

    Raises ValueError if the league type cannot be determined.
    """
    remainder = league_name
    for prefix in _LEAGUE_PREFIXES:
        if remainder.startswith(prefix):
            remainder = remainder[len(prefix):]
            break

    for lt in ("AL", "NL", "BL"):
        if remainder.startswith(lt):
            return lt

    raise ValueError(
        f"Cannot derive league type from name: {league_name!r}. "
        "Expected name to start with AL, NL, or BL after stripping known prefixes."
    )


def parse_league_list_html(html: str) -> list[ScrapedLeague]:
    """
    Parse BB_LeagueList.php HTML into a list of ScrapedLeague objects.

    Finds all <a> tags with hrefs matching ../DIRNAME/LEAGUENAME.htm.
    Maps FOR_WWW -> FOR_WWW1 (JS files live in FOR_WWW1, not FOR_WWW).
    CWWW stays CWWW. Unknown directories are skipped.

    Returns leagues sorted by name.
    """
    soup = BeautifulSoup(html, "html.parser")
    leagues: list[ScrapedLeague] = []

    for tag in soup.find_all("a", href=True):
        href = tag["href"]
        m = _HREF_RE.search(href)
        if not m:
            continue

        src_dir, league_slug = m.group(1), m.group(2)

        js_dir = _DIR_MAP.get(src_dir)
        if js_dir is None:
            logger.debug("Skipping unknown directory in href: %s", href)
            continue

        data_path = f"{js_dir}/{league_slug}"
        name = tag.get_text(strip=True)
        if not name:
            name = league_slug.replace("_", " ")

        leagues.append(ScrapedLeague(name=name, data_path=data_path))

    leagues.sort(key=lambda lg: lg.name)
    return leagues


def parse_league_js(js_content: str) -> list[ScrapedTeam]:
    """
    Extract owner names from a Scoresheet league JS file.

    Safety-critical: uses regex only, never eval/exec.

    The JS files contain a data structure with an ``owner`` array:
        owner : ["Alice", "Bob", ...]

    Validation rules:
    - Must find an owner array
    - Must have between 1 and 20 entries
    - Names are stripped of whitespace, truncated to 100 chars
    - Empty names are replaced with "Team #N"

    Returns a 1-indexed list of ScrapedTeam objects.

    Raises ValueError for missing/empty arrays or invalid entry counts.
    """
    m = _OWNER_ARRAY_RE.search(js_content)
    if not m:
        raise ValueError("No 'owner' array found in JS content")

    array_body = m.group(1)

    # Try double-quoted strings first, fall back to single-quoted
    names = _DOUBLE_QUOTED_RE.findall(array_body)
    if not names:
        names = _SINGLE_QUOTED_RE.findall(array_body)

    if not names:
        raise ValueError("owner array found but contains no parseable names")

    if len(names) > 20:
        raise ValueError(f"owner array has {len(names)} entries (max 20)")

    teams: list[ScrapedTeam] = []
    for i, raw_name in enumerate(names, start=1):
        name = raw_name.strip()[:100]
        if not name:
            name = f"Team #{i}"
        teams.append(ScrapedTeam(scoresheet_id=i, owner_name=name))

    return teams


def parse_league_rosters_js(js_content: str) -> list[ScrapedRoster]:
    """
    Extract team roster pin arrays from a Scoresheet league JS file.

    Safety-critical: uses regex only, never eval/exec.

    The JS files contain a ``rosters`` array where each element has a
    ``pins`` array of Scoresheet player IDs:
        rosters: [
            { pins: [5, 34, 73, 133, ...], ... },  // team 1
            { pins: [18, 20, 38, 43, ...], ... },  // team 2
            ...
        ]

    Returns a 1-indexed list of ScrapedRoster objects (index 0 → scoresheet_id 1).

    Raises ValueError if no rosters array or no pins arrays are found.
    """
    if not _ROSTERS_ARRAY_RE.search(js_content):
        raise ValueError("No 'rosters' array found in JS content")

    pin_matches = _PINS_ARRAY_RE.findall(js_content)
    if not pin_matches:
        raise ValueError("'rosters' array found but contains no 'pins' arrays")

    rosters: list[ScrapedRoster] = []
    for i, pins_str in enumerate(pin_matches, start=1):
        pins = [
            int(token.strip())
            for token in pins_str.split(",")
            if token.strip().lstrip("-").isdigit() and int(token.strip()) > 0
        ]
        rosters.append(ScrapedRoster(scoresheet_id=i, pins=pins))

    return rosters


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
# In-memory cache
# ---------------------------------------------------------------------------


async def refresh_league_cache() -> list[ScrapedLeague]:
    """Re-scrape BB_LeagueList.php and update the in-memory cache."""
    global _league_cache
    async with _scrape_lock:
        async with httpx.AsyncClient() as client:
            leagues = await fetch_league_list(client)
        _league_cache = leagues
    logger.info("League cache refreshed: %d leagues", len(_league_cache))
    return _league_cache


def get_cached_leagues() -> list[ScrapedLeague]:
    """Return the in-memory league cache (instant, no I/O)."""
    return _league_cache


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
                        status="rostered",
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

    await session.commit()

    return {
        "teams_processed": len(team_map),
        "players_added": added_count,
        "players_removed": removed_count,
        "unresolved_pins": unresolved_pins,
    }
