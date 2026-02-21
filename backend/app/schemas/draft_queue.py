"""Draft queue schemas."""

from pydantic import BaseModel


class DraftQueueResponse(BaseModel):
    """Response containing draft queue player IDs (ordered by rank)."""

    player_ids: list[int]


class DraftQueueAddRequest(BaseModel):
    """Request to add a player to the draft queue."""

    player_id: int


class DraftQueueReorderRequest(BaseModel):
    """Request to reorder the entire draft queue."""

    player_ids: list[int]
