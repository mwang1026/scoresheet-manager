"""API dependencies for request context."""

import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import League, Team, User, UserTeam

logger = logging.getLogger(__name__)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_user_email: Annotated[str | None, Header(alias="X-User-Email")] = None,
) -> User:
    """
    Resolve the authenticated user from request context.

    In production: reads X-User-Email header injected by Next.js middleware
    after decrypting the Auth.js session token.

    Dev bypass: when AUTH_SECRET is empty, falls back to looking up the user
    associated with DEFAULT_TEAM_ID via user_teams (mirrors APIKeyMiddleware bypass).

    Args:
        db: Database session
        x_user_email: Optional email from X-User-Email header

    Returns:
        User ORM object

    Raises:
        HTTPException: 401 if user cannot be resolved
    """
    # Production path: trust X-User-Email injected by Next.js middleware
    if x_user_email:
        logger.debug("Auth: resolving user by X-User-Email header")
        result = await db.execute(select(User).where(User.email == x_user_email))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    # Dev bypass: no header present and no AUTH_SECRET configured
    if not settings.AUTH_SECRET:
        logger.debug("Auth: dev bypass via DEFAULT_TEAM_ID=%d", settings.DEFAULT_TEAM_ID)
        result = await db.execute(
            select(User)
            .join(UserTeam, UserTeam.user_id == User.id)
            .where(UserTeam.team_id == settings.DEFAULT_TEAM_ID)
            .limit(1)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="No user found for default team")
        return user

    raise HTTPException(status_code=401, detail="Not authenticated")


async def get_current_team(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    x_team_id: Annotated[int | None, Header(alias="X-Team-Id")] = None,
) -> Team:
    """
    Get the current team for the request.

    Reads X-Team-Id header or falls back to DEFAULT_TEAM_ID.
    In production (AUTH_SECRET set), verifies the user owns the team.

    Args:
        db: Database session
        user: Authenticated user (resolved by get_current_user)
        x_team_id: Optional team ID from X-Team-Id header

    Returns:
        Team object

    Raises:
        HTTPException: 401 if team not found, 403 if user lacks access
    """
    team_id = x_team_id or settings.DEFAULT_TEAM_ID
    team = await db.get(Team, team_id)

    if not team:
        raise HTTPException(status_code=401, detail="Team not found")

    # Skip ownership check in dev mode (AUTH_SECRET empty)
    if not settings.AUTH_SECRET:
        return team

    # Verify user has access to this team
    result = await db.execute(
        select(UserTeam).where(UserTeam.user_id == user.id, UserTeam.team_id == team.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You do not have access to this team")

    return team


async def get_optional_league(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_team_id: Annotated[int | None, Header(alias="X-Team-Id")] = None,
) -> League | None:
    """
    Optionally resolve the league for the current team.

    Returns None if no team context is available (no header and no DEFAULT_TEAM_ID
    configured), allowing graceful degradation when league context is absent.

    Args:
        db: Database session
        x_team_id: Optional team ID from X-Team-Id header

    Returns:
        League object or None
    """
    team_id = x_team_id or settings.DEFAULT_TEAM_ID
    if not team_id:
        return None

    team = await db.get(Team, team_id)
    if not team or not team.league_id:
        return None

    league = await db.get(League, team.league_id)
    return league
