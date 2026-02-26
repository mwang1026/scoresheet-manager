"""Draft queue API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_team
from app.database import get_db
from app.models import DraftQueue, Team, Watchlist
from app.services.roster import check_player_rostered
from app.schemas.draft_queue import (
    DraftQueueAddRequest,
    DraftQueueReorderRequest,
    DraftQueueResponse,
)

router = APIRouter(prefix="/api/draft-queue", tags=["draft-queue"])


@router.get("", response_model=DraftQueueResponse)
async def get_draft_queue(
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> DraftQueueResponse:
    """
    Get the draft queue for the current team.

    Returns player IDs ordered by rank (ascending).
    """
    query = (
        select(DraftQueue.player_id)
        .where(DraftQueue.team_id == team.id)
        .order_by(DraftQueue.rank)
    )

    result = await db.execute(query)
    player_ids = [row[0] for row in result.fetchall()]

    return DraftQueueResponse(player_ids=player_ids)


@router.post("", response_model=DraftQueueResponse)
async def add_to_draft_queue(
    request: DraftQueueAddRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> DraftQueueResponse:
    """
    Add a player to the draft queue.

    Automatically adds the player to the watchlist if not already present.
    Places the player at the end of the queue.
    Idempotent - if player is already in queue, no error is raised.
    Returns the updated queue.
    """
    # Check if player is already rostered in this league
    if team.league_id:
        is_rostered, owner_name = await check_player_rostered(
            db, request.player_id, team.league_id
        )
        if is_rostered:
            raise HTTPException(
                status_code=409,
                detail=f"Already rostered by {owner_name}",
            )

    # First, ensure player is in watchlist (coupling invariant)
    watchlist_stmt = insert(Watchlist.__table__).values(
        team_id=team.id,
        player_id=request.player_id,
    )
    watchlist_stmt = watchlist_stmt.on_conflict_do_nothing(
        index_elements=["team_id", "player_id"]
    )
    await db.execute(watchlist_stmt)

    # Get current max rank
    max_rank_result = await db.execute(
        select(DraftQueue.rank)
        .where(DraftQueue.team_id == team.id)
        .order_by(DraftQueue.rank.desc())
        .limit(1)
    )
    max_rank = max_rank_result.scalar()
    new_rank = (max_rank + 1) if max_rank is not None else 0

    # Add to queue at end
    queue_stmt = insert(DraftQueue.__table__).values(
        team_id=team.id,
        player_id=request.player_id,
        rank=new_rank,
    )
    queue_stmt = queue_stmt.on_conflict_do_nothing(
        index_elements=["team_id", "player_id"]
    )
    await db.execute(queue_stmt)

    await db.commit()

    # Return updated queue
    return await get_draft_queue(db, team)


@router.delete("/{player_id}", response_model=DraftQueueResponse)
async def remove_from_draft_queue(
    player_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> DraftQueueResponse:
    """
    Remove a player from the draft queue.

    Does NOT remove from watchlist (queue is a subset of watchlist).
    Idempotent - if player is not in queue, no error is raised.
    Returns the updated queue.
    """
    # Remove from queue
    await db.execute(
        delete(DraftQueue).where(
            DraftQueue.team_id == team.id,
            DraftQueue.player_id == player_id,
        )
    )

    # Rerank remaining items to maintain contiguous ranks
    remaining_result = await db.execute(
        select(DraftQueue)
        .where(DraftQueue.team_id == team.id)
        .order_by(DraftQueue.rank)
    )
    remaining_items = remaining_result.scalars().all()

    for idx, item in enumerate(remaining_items):
        item.rank = idx

    await db.commit()

    # Return updated queue
    return await get_draft_queue(db, team)


@router.put("/reorder", response_model=DraftQueueResponse)
async def reorder_draft_queue(
    request: DraftQueueReorderRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> DraftQueueResponse:
    """
    Reorder the entire draft queue.

    Replaces the queue with the provided order.
    All player_ids must already be in the queue.
    Returns the updated queue.
    """
    # Delete all current queue items
    await db.execute(delete(DraftQueue).where(DraftQueue.team_id == team.id))

    # Insert with new ranks
    if request.player_ids:
        queue_rows = [
            {"team_id": team.id, "player_id": player_id, "rank": idx}
            for idx, player_id in enumerate(request.player_ids)
        ]
        stmt = insert(DraftQueue.__table__).values(queue_rows)
        await db.execute(stmt)

    await db.commit()

    # Return updated queue
    return await get_draft_queue(db, team)
