"""Draft queue API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DraftQueue, Watchlist
from app.schemas.draft_queue import (
    DraftQueueAddRequest,
    DraftQueueReorderRequest,
    DraftQueueResponse,
)

router = APIRouter(prefix="/api/draft-queue", tags=["draft-queue"])

# Hardcoded user_id for MVP (auth not implemented yet)
CURRENT_USER_ID = 1


@router.get("", response_model=DraftQueueResponse)
async def get_draft_queue(
    db: AsyncSession = Depends(get_db),
) -> DraftQueueResponse:
    """
    Get the draft queue for the current user.

    Returns player IDs ordered by rank (ascending).
    """
    query = (
        select(DraftQueue.player_id)
        .where(DraftQueue.user_id == CURRENT_USER_ID)
        .order_by(DraftQueue.rank)
    )

    result = await db.execute(query)
    player_ids = [row[0] for row in result.fetchall()]

    return DraftQueueResponse(player_ids=player_ids)


@router.post("", response_model=DraftQueueResponse)
async def add_to_draft_queue(
    request: DraftQueueAddRequest,
    db: AsyncSession = Depends(get_db),
) -> DraftQueueResponse:
    """
    Add a player to the draft queue.

    Automatically adds the player to the watchlist if not already present.
    Places the player at the end of the queue.
    Idempotent - if player is already in queue, no error is raised.
    Returns the updated queue.
    """
    # First, ensure player is in watchlist (coupling invariant)
    watchlist_stmt = insert(Watchlist.__table__).values(
        user_id=CURRENT_USER_ID,
        player_id=request.player_id,
    )
    watchlist_stmt = watchlist_stmt.on_conflict_do_nothing(
        index_elements=["user_id", "player_id"]
    )
    await db.execute(watchlist_stmt)

    # Get current max rank
    max_rank_result = await db.execute(
        select(DraftQueue.rank)
        .where(DraftQueue.user_id == CURRENT_USER_ID)
        .order_by(DraftQueue.rank.desc())
        .limit(1)
    )
    max_rank = max_rank_result.scalar()
    new_rank = (max_rank + 1) if max_rank is not None else 0

    # Add to queue at end
    queue_stmt = insert(DraftQueue.__table__).values(
        user_id=CURRENT_USER_ID,
        player_id=request.player_id,
        rank=new_rank,
    )
    queue_stmt = queue_stmt.on_conflict_do_nothing(
        index_elements=["user_id", "player_id"]
    )
    await db.execute(queue_stmt)

    await db.commit()

    # Return updated queue
    return await get_draft_queue(db)


@router.delete("/{player_id}", response_model=DraftQueueResponse)
async def remove_from_draft_queue(
    player_id: int,
    db: AsyncSession = Depends(get_db),
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
            DraftQueue.user_id == CURRENT_USER_ID,
            DraftQueue.player_id == player_id,
        )
    )

    # Rerank remaining items to maintain contiguous ranks
    remaining_result = await db.execute(
        select(DraftQueue)
        .where(DraftQueue.user_id == CURRENT_USER_ID)
        .order_by(DraftQueue.rank)
    )
    remaining_items = remaining_result.scalars().all()

    for idx, item in enumerate(remaining_items):
        item.rank = idx

    await db.commit()

    # Return updated queue
    return await get_draft_queue(db)


@router.put("/reorder", response_model=DraftQueueResponse)
async def reorder_draft_queue(
    request: DraftQueueReorderRequest,
    db: AsyncSession = Depends(get_db),
) -> DraftQueueResponse:
    """
    Reorder the entire draft queue.

    Replaces the queue with the provided order.
    All player_ids must already be in the queue.
    Returns the updated queue.
    """
    # Delete all current queue items
    await db.execute(delete(DraftQueue).where(DraftQueue.user_id == CURRENT_USER_ID))

    # Insert with new ranks
    if request.player_ids:
        queue_rows = [
            {"user_id": CURRENT_USER_ID, "player_id": player_id, "rank": idx}
            for idx, player_id in enumerate(request.player_ids)
        ]
        stmt = insert(DraftQueue.__table__).values(queue_rows)
        await db.execute(stmt)

    await db.commit()

    # Return updated queue
    return await get_draft_queue(db)
