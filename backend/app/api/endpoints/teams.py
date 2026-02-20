"""Teams API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Team
from app.schemas.team import TeamListItem, TeamListResponse

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("", response_model=TeamListResponse)
async def list_teams(
    db: AsyncSession = Depends(get_db),
) -> TeamListResponse:
    """
    List all fantasy teams.

    Returns all teams ordered by scoresheet_id.
    """
    query = select(Team).order_by(Team.scoresheet_id)

    result = await db.execute(query)
    teams = result.scalars().all()

    return TeamListResponse(teams=[TeamListItem.model_validate(t) for t in teams])
