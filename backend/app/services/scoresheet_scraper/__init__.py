"""
Scoresheet.com scraper package.

Converts the original scoresheet_scraper.py module into a package:
  parser.py  — pure parsing functions (no I/O)
  service.py — async fetch wrappers and DB persistence helpers

The in-memory cache (_league_cache) and its management functions live here
so that module-level state is accessible as
`app.services.scoresheet_scraper._league_cache` (required by tests and
by code that patches the cache via setattr).
"""

import logging

import httpx

from .parser import (
    ScrapedLeague,
    ScrapedRoster,
    ScrapedTeam,
    derive_league_type,
    parse_league_js,
    parse_league_list_html,
    parse_league_rosters_js,
)
from .service import (
    LEAGUE_LIST_URL,
    REQUEST_TIMEOUT,
    SCORESHEET_BASE_URL,
    _scrape_lock,
    fetch_league_list,
    fetch_league_teams,
    persist_league_and_teams,
    scrape_and_persist_rosters,
)
from .draft_parser import (
    DraftConfig,
    PicksSchedule,
    UpcomingPick,
    CompletedPick,
    ParsedTransactions,
    parse_draft_config,
    parse_transactions_js,
    compute_upcoming_picks,
)
from .draft_service import (
    get_draft_cooldown,
    scrape_and_persist_draft,
    _draft_cooldowns,
    _draft_scrape_lock,
    COOLDOWN_SECONDS,
)

logger = logging.getLogger(__name__)

# In-memory cache populated at startup and on refresh.
# Lives here (not in service.py) so that `app.services.scoresheet_scraper._league_cache`
# is the authoritative attribute — consistent with the original single-file design.
_league_cache: list[ScrapedLeague] = []


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


__all__ = [
    # Models
    "ScrapedLeague",
    "ScrapedRoster",
    "ScrapedTeam",
    # Pure parsing
    "derive_league_type",
    "parse_league_js",
    "parse_league_list_html",
    "parse_league_rosters_js",
    # Draft parsing
    "DraftConfig",
    "PicksSchedule",
    "UpcomingPick",
    "CompletedPick",
    "ParsedTransactions",
    "parse_draft_config",
    "parse_transactions_js",
    "compute_upcoming_picks",
    # Fetch wrappers
    "fetch_league_list",
    "fetch_league_teams",
    # Cache management
    "_league_cache",
    "refresh_league_cache",
    "get_cached_leagues",
    # DB persistence
    "persist_league_and_teams",
    "scrape_and_persist_rosters",
    # Draft persistence
    "scrape_and_persist_draft",
    "get_draft_cooldown",
    "_draft_cooldowns",
    "_draft_scrape_lock",
    "COOLDOWN_SECONDS",
    # Constants
    "SCORESHEET_BASE_URL",
    "LEAGUE_LIST_URL",
    "REQUEST_TIMEOUT",
]
