"""Stats API endpoints."""

from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import HitterDailyStats, PitcherDailyStats, Player
from app.schemas.stats import (
    HitterDailyStatsItem,
    HitterStatsListResponse,
    PitcherDailyStatsItem,
    PitcherStatsListResponse,
)

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/hitters", response_model=HitterStatsListResponse)
async def list_hitter_stats(
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    player_id: int | None = Query(None, description="Optional player ID filter"),
    db: AsyncSession = Depends(get_db),
) -> HitterStatsListResponse:
    """
    Get raw daily hitter stats for a date range.

    IMPORTANT: Only returns stats for Scoresheet league players (players with scoresheet_id).
    Frontend calculates AVG, OPS, etc. from these raw stats.

    Args:
        start: Start date (required to prevent full-table scan)
        end: End date (required to prevent full-table scan)
        player_id: Optional filter for single player (for player detail page)
    """
    # Build query - join with players to filter to Scoresheet league only
    query = (
        select(HitterDailyStats)
        .join(Player, HitterDailyStats.player_id == Player.id)
        .where(Player.scoresheet_only())
        .where(HitterDailyStats.date >= start)
        .where(HitterDailyStats.date <= end)
    )

    # Apply player filter if specified
    if player_id is not None:
        query = query.where(HitterDailyStats.player_id == player_id)

    # Order by player, then date
    query = query.order_by(HitterDailyStats.player_id, HitterDailyStats.date)

    # Execute query
    result = await db.execute(query)
    stats = result.scalars().all()

    return HitterStatsListResponse(stats=[HitterDailyStatsItem.model_validate(s) for s in stats])


@router.get("/pitchers", response_model=PitcherStatsListResponse)
async def list_pitcher_stats(
    start: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end: date = Query(..., description="End date (YYYY-MM-DD)"),
    player_id: int | None = Query(None, description="Optional player ID filter"),
    db: AsyncSession = Depends(get_db),
) -> PitcherStatsListResponse:
    """
    Get raw daily pitcher stats for a date range.

    IMPORTANT: Only returns stats for Scoresheet league players (players with scoresheet_id).
    Frontend calculates ERA, WHIP, etc. from these raw stats.

    Args:
        start: Start date (required to prevent full-table scan)
        end: End date (required to prevent full-table scan)
        player_id: Optional filter for single player (for player detail page)
    """
    # Build query - join with players to filter to Scoresheet league only
    query = (
        select(PitcherDailyStats)
        .join(Player, PitcherDailyStats.player_id == Player.id)
        .where(Player.scoresheet_only())
        .where(PitcherDailyStats.date >= start)
        .where(PitcherDailyStats.date <= end)
    )

    # Apply player filter if specified
    if player_id is not None:
        query = query.where(PitcherDailyStats.player_id == player_id)

    # Order by player, then date
    query = query.order_by(PitcherDailyStats.player_id, PitcherDailyStats.date)

    # Execute query
    result = await db.execute(query)
    stats = result.scalars().all()

    return PitcherStatsListResponse(
        stats=[PitcherDailyStatsItem.model_validate(s) for s in stats]
    )
