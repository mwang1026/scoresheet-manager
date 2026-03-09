"""Custom positions API endpoints — OOP position tagging per team."""

from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_team
from app.database import get_db
from app.models import Player, PlayerPosition, Team
from app.models.custom_position import CustomPosition
from app.schemas.custom_position import (
    CustomPositionAddRequest,
    CustomPositionsResponse,
)

router = APIRouter(prefix="/api", tags=["custom-positions"])

VALID_OOP_POSITIONS = {"1B", "2B", "3B", "SS", "OF"}


async def _has_natural_eligibility(db: AsyncSession, player: Player, position: str) -> bool:
    """Check if a player already has natural eligibility at a position."""
    if player.primary_position == position:
        return True
    # Check PlayerPosition table for secondary eligibility
    result = await db.execute(
        select(PlayerPosition).where(
            PlayerPosition.player_id == player.id,
            PlayerPosition.position == position,
        )
    )
    return result.scalars().first() is not None


@router.get("/custom-positions", response_model=CustomPositionsResponse)
async def get_custom_positions(
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> CustomPositionsResponse:
    """Fetch all custom positions for the current team as player_id -> positions map."""
    result = await db.execute(
        select(CustomPosition).where(CustomPosition.team_id == team.id)
    )
    rows = result.scalars().all()

    positions: dict[int, list[str]] = defaultdict(list)
    for row in rows:
        positions[row.player_id].append(row.position)

    return CustomPositionsResponse(positions=dict(positions))


@router.post("/custom-positions", response_model=CustomPositionsResponse)
async def add_custom_position(
    request: CustomPositionAddRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> CustomPositionsResponse:
    """Add a custom OOP position for a player. Idempotent (ON CONFLICT DO NOTHING)."""
    if request.position not in VALID_OOP_POSITIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid position '{request.position}'. Must be one of: {', '.join(sorted(VALID_OOP_POSITIONS))}",
        )

    # Verify player exists
    player = await db.get(Player, request.player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Reject if player already has natural eligibility
    if await _has_natural_eligibility(db, player, request.position):
        raise HTTPException(
            status_code=409,
            detail=f"Player already has natural eligibility at {request.position}",
        )

    # Check if already exists (idempotent)
    existing = await db.execute(
        select(CustomPosition).where(
            CustomPosition.team_id == team.id,
            CustomPosition.player_id == request.player_id,
            CustomPosition.position == request.position,
        )
    )
    if not existing.scalars().first():
        cp = CustomPosition(
            team_id=team.id,
            player_id=request.player_id,
            position=request.position,
        )
        db.add(cp)
        await db.commit()

    # Return full map for this team
    return await get_custom_positions(db=db, team=team)


@router.delete("/custom-positions/{player_id}/{position}", response_model=CustomPositionsResponse)
async def remove_custom_position(
    player_id: int,
    position: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> CustomPositionsResponse:
    """Remove a custom OOP position for a player."""
    result = await db.execute(
        select(CustomPosition).where(
            CustomPosition.team_id == team.id,
            CustomPosition.player_id == player_id,
            CustomPosition.position == position,
        )
    )
    cp = result.scalars().first()
    if cp:
        await db.delete(cp)
        await db.commit()

    # Return full map for this team
    return await get_custom_positions(db=db, team=team)
