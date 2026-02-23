"""Teams API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import League, Team, UserTeam
from app.schemas.team import MyTeamItem, MyTeamsResponse, TeamListItem, TeamListResponse

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
