"""Player API endpoints."""

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Player, PlayerPosition
from app.schemas.player import PlayerDetail, PlayerListItem, PlayerListResponse

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("", response_model=PlayerListResponse)
async def list_players(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    position: str | None = Query(None, description="Filter by primary position"),
    team: str | None = Query(None, description="Filter by current MLB team"),
    db: AsyncSession = Depends(get_db),
) -> PlayerListResponse:
    """
    List Scoresheet league players (paginated).

    IMPORTANT: Only returns players with scoresheet_id (league-eligible players).
    PECOTA-only players are excluded.
    """
    # Build base query - FILTER TO SCORESHEET PLAYERS ONLY
    query = select(Player).where(Player.scoresheet_id.isnot(None))

    # Apply filters
    if position:
        query = query.where(Player.primary_position == position)
    if team:
        query = query.where(Player.current_mlb_team == team)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(Player.last_name, Player.first_name).offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    players = result.scalars().all()

    # Calculate total pages
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PlayerListResponse(
        players=[PlayerListItem.model_validate(p) for p in players],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{player_id}", response_model=PlayerDetail)
async def get_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
) -> PlayerDetail:
    """
    Get detailed player information.

    Includes defensive positions, catcher steal rates, and batting splits.
    """
    # Get player
    query = select(Player).where(Player.id == player_id)
    result = await db.execute(query)
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Load positions separately
    positions_query = select(PlayerPosition).where(PlayerPosition.player_id == player_id)
    positions_result = await db.execute(positions_query)
    positions = positions_result.scalars().all()

    # Build response
    player_dict = {
        "id": player.id,
        "first_name": player.first_name,
        "last_name": player.last_name,
        "scoresheet_id": player.scoresheet_id,
        "mlb_id": player.mlb_id,
        "bp_id": player.bp_id,
        "scoresheet_nl_id": player.scoresheet_nl_id,
        "primary_position": player.primary_position,
        "bats": player.bats,
        "throws": player.throws,
        "age": player.age,
        "birthday": player.birthday,
        "height": player.height,
        "weight": player.weight,
        "current_mlb_team": player.current_mlb_team,
        "is_trade_bait": player.is_trade_bait,
        "positions": [{"position": p.position, "rating": p.rating} for p in positions],
        "osb_al": player.osb_al,
        "ocs_al": player.ocs_al,
        "osb_nl": player.osb_nl,
        "ocs_nl": player.ocs_nl,
        "ba_vr": player.ba_vr,
        "ob_vr": player.ob_vr,
        "sl_vr": player.sl_vr,
        "ba_vl": player.ba_vl,
        "ob_vl": player.ob_vl,
        "sl_vl": player.sl_vl,
    }

    return PlayerDetail(**player_dict)
