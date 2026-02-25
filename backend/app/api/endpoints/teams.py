"""Teams API endpoints."""

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.api.endpoints.scoresheet import limiter
from app.config import settings
from app.database import get_db
from app.models import League, Team, User, UserTeam
from app.schemas.team import (
    AddTeamRequest,
    MyTeamItem,
    MyTeamsResponse,
    TeamListItem,
    TeamListResponse,
)
from app.services.scoresheet_scraper import (
    fetch_league_teams,
    get_cached_leagues,
    persist_league_and_teams,
    scrape_and_persist_rosters,
)

router = APIRouter(prefix="/api/teams", tags=["teams"])
me_router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("", response_model=TeamListResponse)
async def list_teams(
    db: Annotated[AsyncSession, Depends(get_db)],
    league_id: int | None = None,
    x_team_id: Annotated[int | None, Header(alias="X-Team-Id")] = None,
) -> TeamListResponse:
    """
    List all fantasy teams.

    Optionally filter by league_id.
    Returns teams ordered by scoresheet_id.
    Computes is_my_team for backward compatibility with frontend.
    """
    # Determine current team for is_my_team computation
    current_team_id = x_team_id or settings.DEFAULT_TEAM_ID

    # Build query with league join to get league_name
    query = select(Team, League.name.label("league_name")).join(
        League, Team.league_id == League.id
    )
    if league_id is not None:
        query = query.where(Team.league_id == league_id)
    query = query.order_by(Team.scoresheet_id)

    result = await db.execute(query)
    rows = result.all()

    # Build response with computed is_my_team
    team_items = [
        TeamListItem(
            id=row.Team.id,
            name=row.Team.name,
            scoresheet_id=row.Team.scoresheet_id,
            league_id=row.Team.league_id,
            league_name=row.league_name,
            is_my_team=(row.Team.id == current_team_id),
        )
        for row in rows
    ]

    return TeamListResponse(teams=team_items)


@me_router.get("/teams", response_model=MyTeamsResponse)
async def get_my_teams(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_team_id: Annotated[int | None, Header(alias="X-Team-Id")] = None,
) -> MyTeamsResponse:
    """
    Get all teams for the current user with league info.

    Resolves the user via X-Team-Id → user_teams, then returns all teams
    for that user ordered by league name, then scoresheet_id.
    """
    current_team_id = x_team_id or settings.DEFAULT_TEAM_ID

    # Find the user associated with this team
    user_team_result = await db.execute(
        select(UserTeam).where(UserTeam.team_id == current_team_id)
    )
    user_team = user_team_result.scalars().first()

    if user_team is None:
        return MyTeamsResponse(teams=[])

    user_id = user_team.user_id

    # Fetch all teams for this user with league info
    stmt = (
        select(Team, League, UserTeam.role)
        .join(UserTeam, UserTeam.team_id == Team.id)
        .join(League, League.id == Team.league_id)
        .where(UserTeam.user_id == user_id)
        .order_by(League.name, Team.scoresheet_id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    team_items = [
        MyTeamItem(
            id=row[0].id,
            name=row[0].name,
            scoresheet_id=row[0].scoresheet_id,
            league_id=row[0].league_id,
            league_name=row[1].name,
            league_season=row[1].season,
            role=row[2],
        )
        for row in rows
    ]

    return MyTeamsResponse(teams=team_items)


@me_router.post("/teams", response_model=MyTeamItem, status_code=201)
@limiter.limit("5/minute")
async def add_my_team(
    request: Request,
    body: AddTeamRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MyTeamItem:
    """
    Add a team association for the current user.

    Flow:
    1. Validate data_path against in-memory league cache (400 if not found)
    2. Fast path: if league + team already in DB, skip scraping
    3. Slow path: fetch team owners from Scoresheet.com, upsert league + teams
    4. Return 409 if user already has this team
    5. Create UserTeam association
    6. Scrape and refresh rosters for all teams in the league
    7. Return the new MyTeamItem (201)

    Rate limited to 5/minute (may trigger outbound scrape).
    """
    # 1. Validate data_path against cache
    cached = {lg.data_path: lg.name for lg in get_cached_leagues()}
    league_name = cached.get(body.data_path)
    if league_name is None:
        raise HTTPException(
            status_code=400,
            detail=f"League '{body.data_path}' not found in cache. "
            "Refresh via POST /api/scoresheet/leagues/refresh first.",
        )

    # 2. Fast path: look up league by scoresheet_data_path, team by (league_id, scoresheet_id)
    league_result = await db.execute(
        select(League).where(League.scoresheet_data_path == body.data_path)
    )
    league = league_result.scalar_one_or_none()

    team = None
    if league is not None:
        team_result = await db.execute(
            select(Team).where(
                Team.league_id == league.id,
                Team.scoresheet_id == body.scoresheet_team_id,
            )
        )
        team = team_result.scalar_one_or_none()

    # 3. Slow path: scrape and persist if league or team not in DB
    if league is None or team is None:
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

        league = await persist_league_and_teams(
            session=db,
            league_name=league_name,
            data_path=body.data_path,
            teams=scraped_teams,
            season=settings.SEED_LEAGUE_SEASON,
        )

        # Re-fetch team after persistence
        team_result = await db.execute(
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

    # 4. Check for existing association (409)
    existing_result = await db.execute(
        select(UserTeam).where(
            UserTeam.user_id == user.id,
            UserTeam.team_id == team.id,
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="User is already associated with this team",
        )

    # 5. Create UserTeam association
    user_team = UserTeam(user_id=user.id, team_id=team.id, role="owner")
    db.add(user_team)
    await db.commit()
    await db.refresh(user_team)

    # 6. Scrape and persist rosters (best-effort — don't fail the request)
    try:
        await scrape_and_persist_rosters(db, league)
    except Exception:
        pass  # Roster sync failure is non-fatal; log if needed

    # 7. Return MyTeamItem
    league_result = await db.execute(select(League).where(League.id == league.id))
    league = league_result.scalar_one()

    return MyTeamItem(
        id=team.id,
        name=team.name,
        scoresheet_id=team.scoresheet_id,
        league_id=league.id,
        league_name=league.name,
        league_season=league.season,
        role=user_team.role,
    )


@me_router.delete("/teams/{team_id}", status_code=204)
async def remove_my_team(
    team_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """
    Remove a team association for the current user.

    Only deletes the UserTeam row — league, team, and roster data remain.
    Returns 404 if the association doesn't exist.
    Returns 400 if this is the user's last team (must keep at least one).
    """
    # Find the UserTeam association
    ut_result = await db.execute(
        select(UserTeam).where(
            UserTeam.user_id == user.id,
            UserTeam.team_id == team_id,
        )
    )
    user_team = ut_result.scalar_one_or_none()
    if user_team is None:
        raise HTTPException(
            status_code=404,
            detail="Team association not found",
        )

    # Count user's total teams — prevent removing the last one
    count_result = await db.execute(
        select(func.count()).where(UserTeam.user_id == user.id)
    )
    total = count_result.scalar_one()
    if total <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove last team",
        )

    # Delete only the UserTeam row
    await db.delete(user_team)
    await db.commit()
    return Response(status_code=204)
