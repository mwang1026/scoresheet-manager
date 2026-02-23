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
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import League, Team, User, UserTeam
from app.schemas.scoresheet import (
    OnboardRequest,
    OnboardResponse,
    OnboardRosterSummary,
    RosterRefreshResponse,
    ScrapedLeagueListResponse,
    ScrapedTeamListResponse,
)
from app.services.scoresheet_scraper import (
    fetch_league_teams,
    get_cached_leagues,
    persist_league_and_teams,
    refresh_league_cache,
    scrape_and_persist_rosters,
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


@router.post(
    "/leagues/{league_id}/rosters/refresh",
    response_model=RosterRefreshResponse,
)
@limiter.limit("2/minute")
async def refresh_league_rosters(
    request: Request,
    league_id: int,
    session: AsyncSession = Depends(get_db),
) -> RosterRefreshResponse:
    """
    Scrape team rosters for a league and persist them to player_roster.

    Fetches the league's JS file from Scoresheet.com, parses each team's
    ``pins`` array, maps pins to Player records, and replaces all existing
    player_roster rows for the league.

    Requires the league to have ``scoresheet_data_path`` and ``league_type`` set.
    Rate limited to 2/minute (scraping is expensive).

    Raises:
        404: if league_id is not found
        400: if the league is missing required fields or JS parsing fails
        502: if the upstream Scoresheet site is unreachable
    """
    result = await session.execute(select(League).where(League.id == league_id))
    league = result.scalar_one_or_none()
    if league is None:
        raise HTTPException(status_code=404, detail=f"League {league_id} not found")

    if not league.scoresheet_data_path:
        raise HTTPException(
            status_code=400,
            detail="League has no scoresheet_data_path set",
        )

    try:
        summary = await scrape_and_persist_rosters(session, league)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error fetching rosters: {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error fetching rosters: {e}",
        )

    return RosterRefreshResponse(league_id=league_id, **summary)


@router.post("/onboard", response_model=OnboardResponse)
@limiter.limit("1/minute")
async def onboard(
    request: Request,
    body: OnboardRequest,
    session: AsyncSession = Depends(get_db),
) -> OnboardResponse:
    """
    Self-service onboarding: link a user to a league team and populate rosters.

    Flow:
    1. Look up league name from in-memory cache by data_path (400 if not found)
    2. Fetch team owners from Scoresheet.com via fetch_league_teams()
    3. Upsert league + all 10 teams via persist_league_and_teams()
    4. Upsert User by email, upsert UserTeam for the claimed team
    5. Scrape and persist rosters for the league
    6. Return league_id, team_id, team_name, and roster summary

    Rate limited to 1/minute (makes 2 outbound scrapes).
    Idempotent — safe to call multiple times for the same user/league.

    Security: unauthenticated at user level, protected by APIKeyMiddleware +
    rate limiting. When JWT auth is added, derive user_email from token.

    Raises:
        400: if data_path is not in the league cache or validation fails
        502: if Scoresheet.com is unreachable
    """
    # 1. Resolve league name from cache
    cached = {lg.data_path: lg.name for lg in get_cached_leagues()}
    league_name = cached.get(body.data_path)
    if league_name is None:
        raise HTTPException(
            status_code=400,
            detail=f"League '{body.data_path}' not found in cache. "
            "Refresh via POST /api/scoresheet/leagues/refresh first.",
        )

    # 2. Fetch team owners from Scoresheet.com
    try:
        async with httpx.AsyncClient() as client:
            scraped_teams = await fetch_league_teams(client, body.data_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error fetching teams: {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error fetching teams: {e}",
        )

    # 3. Upsert league + all teams
    league = await persist_league_and_teams(
        session=session,
        league_name=league_name,
        data_path=body.data_path,
        teams=scraped_teams,
        season=settings.SEED_LEAGUE_SEASON,
    )

    # 4. Upsert user
    user_stmt = insert(User.__table__).values(email=body.user_email, role="user")
    user_stmt = user_stmt.on_conflict_do_update(
        index_elements=["email"],
        set_={"role": user_stmt.excluded.role},
    )
    await session.execute(user_stmt)
    await session.flush()

    user_result = await session.execute(
        select(User).where(User.email == body.user_email)
    )
    user = user_result.scalar_one()

    # Look up the claimed team
    team_result = await session.execute(
        select(Team).where(
            Team.league_id == league.id,
            Team.scoresheet_id == body.scoresheet_team_id,
        )
    )
    team = team_result.scalar_one_or_none()
    if team is None:
        raise HTTPException(
            status_code=400,
            detail=f"Team with scoresheet_id={body.scoresheet_team_id} not found in league",
        )

    # Upsert UserTeam
    user_team_stmt = insert(UserTeam.__table__).values(
        user_id=user.id,
        team_id=team.id,
        role="owner",
    )
    user_team_stmt = user_team_stmt.on_conflict_do_nothing(
        index_elements=["user_id", "team_id"]
    )
    await session.execute(user_team_stmt)
    await session.commit()

    # 5. Scrape and persist rosters
    try:
        roster_summary = await scrape_and_persist_rosters(session, league)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error fetching rosters: {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error fetching rosters: {e}",
        )

    return OnboardResponse(
        league_id=league.id,
        team_id=team.id,
        team_name=team.name,
        roster=OnboardRosterSummary(**roster_summary),
    )
