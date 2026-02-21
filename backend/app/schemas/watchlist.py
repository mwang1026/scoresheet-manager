"""Watchlist schemas."""

from pydantic import BaseModel


class WatchlistResponse(BaseModel):
    """Response containing watchlisted player IDs."""

    player_ids: list[int]


class WatchlistAddRequest(BaseModel):
    """Request to add a player to watchlist."""

    player_id: int
