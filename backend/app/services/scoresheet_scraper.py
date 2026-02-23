"""
Scoresheet.com scraper service.

Fetches league list and team owner names from scoresheet.com.
- League list: scraped from BB_LeagueList.php (cached in-memory at startup)
- Team names: scraped per-league from per-league JS files (live, not cached)

All parsing is done via pure functions (no I/O) for testability.
No eval/exec is used anywhere -- JS data is extracted via regex only.
"""

import logging
import re

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import League, Team

logger = logging.getLogger(__name__)

SCORESHEET_BASE_URL = "https://www.scoresheet.com"
LEAGUE_LIST_URL = f"{SCORESHEET_BASE_URL}/BB_LeagueList.php"
REQUEST_TIMEOUT = 15.0

# Maps source directory in href -> JS directory for team data
_DIR_MAP = {
    "FOR_WWW": "FOR_WWW1",
    "CWWW": "CWWW",
}

# In-memory cache populated at startup and on refresh
_league_cache: list["ScrapedLeague"] = []

# Compiled regex patterns
_DATA_PATH_RE = re.compile(r"^[A-Za-z0-9_]+/[A-Za-z0-9_]+$")
_HREF_RE = re.compile(r"\.\./(\w+)/(.+)\.htm$", re.IGNORECASE)
_OWNER_ARRAY_RE = re.compile(r"owner\s*:\s*\[([^\]]+)\]", re.DOTALL)
_DOUBLE_QUOTED_RE = re.compile(r'"([^"]*)"')
_SINGLE_QUOTED_RE = re.compile(r"'([^']*)'")


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


# ---------------------------------------------------------------------------
# Pure parsing functions (no I/O)
# ---------------------------------------------------------------------------


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
    async with httpx.AsyncClient() as client:
        leagues = await fetch_league_list(client)
    _league_cache = leagues
    logger.info("League cache refreshed: %d leagues", len(_league_cache))
    return _league_cache


def get_cached_leagues() -> list[ScrapedLeague]:
    """Return the in-memory league cache (instant, no I/O)."""
    return _league_cache


# ---------------------------------------------------------------------------
# DB persistence helper
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

    - Upserts league by name (unique natural key), sets scoresheet_data_path + season
    - Upserts teams by (league_id, scoresheet_id), name = "Team #N (owner_name)"
    - Returns the League ORM object

    Follows the upsert pattern from seed_league.py and import_teams.py.
    """
    # Upsert league
    league_stmt = insert(League.__table__).values(
        name=league_name,
        season=season,
        scoresheet_data_path=data_path,
    )
    league_stmt = league_stmt.on_conflict_do_update(
        index_elements=["name"],
        set_={
            "season": league_stmt.excluded.season,
            "scoresheet_data_path": league_stmt.excluded.scoresheet_data_path,
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
