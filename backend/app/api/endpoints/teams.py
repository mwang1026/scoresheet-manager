"""Teams API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import League, Team
from app.schemas.team import TeamListItem, TeamListResponse

router = APIRouter(prefix="/api/teams", tags=["teams"])


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
