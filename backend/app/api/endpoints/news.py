"""Player news API endpoints."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.player_news import PlayerNews
from app.schemas.player_news import DashboardNewsItem, NewsFlags, PlayerNewsResponse

router = APIRouter(prefix="/api", tags=["news"])


@router.get("/news", response_model=list[DashboardNewsItem])
async def get_news(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=10, ge=1, le=100),
) -> list[DashboardNewsItem]:
    """Dashboard widget — latest N news items, most recent first."""
    result = await db.execute(
        select(PlayerNews)
        .order_by(PlayerNews.published_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [DashboardNewsItem.model_validate(row) for row in rows]


@router.get("/news/flags", response_model=NewsFlags)
async def get_news_flags(
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=7, ge=1, le=30),
) -> NewsFlags:
    """Return player IDs that have news within the given window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(PlayerNews.player_id)
        .where(
            PlayerNews.player_id.isnot(None),
            PlayerNews.published_at >= cutoff,
        )
        .distinct()
    )
    player_ids = [row[0] for row in result.all()]
    return NewsFlags(player_ids=player_ids)


@router.get("/players/{player_id}/news", response_model=list[PlayerNewsResponse])
async def get_player_news(
    player_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[PlayerNewsResponse]:
    """Player detail — news history for a specific player."""
    result = await db.execute(
        select(PlayerNews)
        .where(PlayerNews.player_id == player_id)
        .order_by(PlayerNews.published_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [PlayerNewsResponse.model_validate(row) for row in rows]
