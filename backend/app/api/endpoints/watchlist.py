"""Watchlist API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DraftQueue, Watchlist
from app.schemas.watchlist import WatchlistAddRequest, WatchlistResponse

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

# Hardcoded user_id for MVP (auth not implemented yet)
CURRENT_USER_ID = 1


@router.get("", response_model=WatchlistResponse)
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    """
    Get all watchlisted player IDs for the current user.

    Returns player IDs in no particular order.
    """
    query = select(Watchlist.player_id).where(Watchlist.user_id == CURRENT_USER_ID)

    result = await db.execute(query)
    player_ids = [row[0] for row in result.fetchall()]

    return WatchlistResponse(player_ids=player_ids)


@router.post("", response_model=WatchlistResponse)
async def add_to_watchlist(
    request: WatchlistAddRequest,
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    """
    Add a player to the watchlist.

    Idempotent - if player is already watchlisted, no error is raised.
    Returns the updated watchlist.
    """
    stmt = insert(Watchlist.__table__).values(
        user_id=CURRENT_USER_ID,
        player_id=request.player_id,
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "player_id"])

    await db.execute(stmt)
    await db.commit()

    # Return updated watchlist
    return await get_watchlist(db)


@router.delete("/{player_id}", response_model=WatchlistResponse)
async def remove_from_watchlist(
    player_id: int,
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    """
    Remove a player from the watchlist.

    Also removes the player from the draft queue (coupling invariant).
    Idempotent - if player is not watchlisted, no error is raised.
    Returns the updated watchlist.
    """
    # Remove from queue first (coupling invariant)
    await db.execute(
        delete(DraftQueue).where(
            DraftQueue.user_id == CURRENT_USER_ID,
            DraftQueue.player_id == player_id,
        )
    )

    # Remove from watchlist
    await db.execute(
        delete(Watchlist).where(
            Watchlist.user_id == CURRENT_USER_ID,
            Watchlist.player_id == player_id,
        )
    )

    await db.commit()

    # Return updated watchlist
    return await get_watchlist(db)
