"""Watchlist API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from posthog import capture, identify_context, new_context
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_team, get_current_user
from app.database import get_db
from app.models import DraftQueue, Team, User, Watchlist
from app.schemas.watchlist import WatchlistAddRequest, WatchlistResponse

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("", response_model=WatchlistResponse)
async def get_watchlist(
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
) -> WatchlistResponse:
    """
    Get all watchlisted player IDs for the current team.

    Returns player IDs in no particular order.
    """
    query = select(Watchlist.player_id).where(Watchlist.team_id == team.id)

    result = await db.execute(query)
    player_ids = [row[0] for row in result.fetchall()]

    return WatchlistResponse(player_ids=player_ids)


@router.post("", response_model=WatchlistResponse)
async def add_to_watchlist(
    request: WatchlistAddRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
    user: Annotated[User, Depends(get_current_user)],
) -> WatchlistResponse:
    """
    Add a player to the watchlist.

    Idempotent - if player is already watchlisted, no error is raised.
    Returns the updated watchlist.
    """
    stmt = insert(Watchlist.__table__).values(
        team_id=team.id,
        player_id=request.player_id,
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["team_id", "player_id"])

    await db.execute(stmt)
    await db.commit()

    with new_context():
        identify_context(str(user.id))
        capture("player_watchlisted", properties={"player_id": request.player_id})

    # Return updated watchlist
    return await get_watchlist(db, team)


@router.delete("/{player_id}", response_model=WatchlistResponse)
async def remove_from_watchlist(
    player_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    team: Annotated[Team, Depends(get_current_team)],
    user: Annotated[User, Depends(get_current_user)],
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
            DraftQueue.team_id == team.id,
            DraftQueue.player_id == player_id,
        )
    )

    # Remove from watchlist
    await db.execute(
        delete(Watchlist).where(
            Watchlist.team_id == team.id,
            Watchlist.player_id == player_id,
        )
    )

    await db.commit()

    with new_context():
        identify_context(str(user.id))
        capture("player_unwatchlisted", properties={"player_id": player_id})

    # Return updated watchlist
    return await get_watchlist(db, team)
