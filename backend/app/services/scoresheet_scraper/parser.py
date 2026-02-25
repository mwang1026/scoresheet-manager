"""
Pure parsing functions for Scoresheet.com data.

No I/O — all functions operate on strings and return data structures.
Safety-critical: uses regex only, never eval/exec.
"""

import logging
import re

from bs4 import BeautifulSoup
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Maps source directory in href -> JS directory for team data
_DIR_MAP = {
    "FOR_WWW": "FOR_WWW1",
    "CWWW": "CWWW",
}

# League name prefixes to strip when deriving league type (longest first)
_LEAGUE_PREFIXES = ["eP-", "wP-", "P-", "e", "w", "a"]

# Compiled regex patterns
_DATA_PATH_RE = re.compile(r"^[A-Za-z0-9_]+/[A-Za-z0-9_]+$")
_HREF_RE = re.compile(r"\.\./(\w+)/(.+)\.htm$", re.IGNORECASE)
_OWNER_ARRAY_RE = re.compile(r"owner_names\s*:\s*\[([^\]]+)\]", re.DOTALL)
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

    The JS files contain a data structure with an ``owner_names`` array:
        owner_names : ["Alice", "Bob", ...]

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
