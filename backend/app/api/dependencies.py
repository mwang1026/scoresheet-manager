"""API dependencies for request context."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Team


async def get_current_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_team_id: Annotated[int | None, Header(alias="X-Team-Id")] = None,
) -> Team:
    """
    Get the current team for the request.

    Pre-auth implementation: Reads X-Team-Id header or falls back to DEFAULT_TEAM_ID.
    When auth is implemented, this will be replaced with JWT-based team lookup.

    Args:
        db: Database session
        x_team_id: Optional team ID from X-Team-Id header

    Returns:
        Team object

    Raises:
        HTTPException: 401 if team not found
    """
    team_id = x_team_id or settings.DEFAULT_TEAM_ID
    team = await db.get(Team, team_id)

    if not team:
        raise HTTPException(status_code=401, detail="Team not found")

    return team
