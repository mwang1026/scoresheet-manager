"""
Scoresheet scraper API endpoints.

Security notes:
- These endpoints are intentionally unauthenticated at the user level (no JWT
  required) to support onboarding flows where the user hasn't logged in yet.
- They are protected at the service level by APIKeyMiddleware (X-Internal-API-Key
  header) and rate limiting via slowapi.
- When real JWT auth is added, POST /leagues/refresh should be restricted to
  admin-only users, as it triggers an outbound HTTP scrape.
"""

import httpx
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.scoresheet import ScrapedLeagueListResponse, ScrapedTeamListResponse
from app.services.scoresheet_scraper import (
    fetch_league_teams,
    get_cached_leagues,
    refresh_league_cache,
)

router = APIRouter(prefix="/api/scoresheet", tags=["scoresheet"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/leagues", response_model=ScrapedLeagueListResponse)
async def list_leagues() -> ScrapedLeagueListResponse:
    """
    Return the cached list of Scoresheet leagues.

    The cache is populated at app startup and can be refreshed via POST /leagues/refresh.
    Returns instantly from memory -- no network I/O.
    """
    leagues = get_cached_leagues()
    return ScrapedLeagueListResponse(
        leagues=[{"name": lg.name, "data_path": lg.data_path} for lg in leagues]
    )


@router.post("/leagues/refresh", response_model=ScrapedLeagueListResponse)
@limiter.limit("2/minute")
async def refresh_leagues(request: Request) -> ScrapedLeagueListResponse:
    """
    Re-scrape BB_LeagueList.php and update the in-memory league cache.

    Returns the updated league list.
    Rate limited to 2/minute (scraping is expensive).
    Raises 502 if the upstream Scoresheet site is unreachable.
    """
    try:
        leagues = await refresh_league_cache()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error fetching league list: {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error fetching league list: {e}",
        )

    return ScrapedLeagueListResponse(
        leagues=[{"name": lg.name, "data_path": lg.data_path} for lg in leagues]
    )


@router.get("/leagues/{data_path:path}/teams", response_model=ScrapedTeamListResponse)
@limiter.limit("10/minute")
async def list_league_teams(request: Request, data_path: str) -> ScrapedTeamListResponse:
    """
    Scrape and return team owner names for the specified league.

    ``data_path`` must match ``^[A-Za-z0-9_]+/[A-Za-z0-9_]+$`` (e.g.
    ``FOR_WWW1/AL_Catfish_Hunter``).  Path traversal attempts are rejected
    with 400.

    The result is not cached -- use this endpoint when the user selects a
    league during signup.
    Rate limited to 10/minute (each call makes an outbound HTTP request).

    Raises:
        400: if data_path fails validation
        502: if the Scoresheet site returns an error
    """
    try:
        async with httpx.AsyncClient() as client:
            teams = await fetch_league_teams(client, data_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error fetching teams for '{data_path}': {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error fetching teams for '{data_path}': {e}",
        )

    return ScrapedTeamListResponse(
        data_path=data_path,
        teams=[
            {"scoresheet_id": t.scoresheet_id, "owner_name": t.owner_name}
            for t in teams
        ],
    )
