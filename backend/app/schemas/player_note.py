"""Player note schemas."""

from datetime import datetime

from pydantic import BaseModel


class PlayerNoteCreateRequest(BaseModel):
    content: str


class PlayerNoteUpdateRequest(BaseModel):
    content: str


class PlayerNoteResponse(BaseModel):
    id: int
    player_id: int
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlayerNoteListResponse(BaseModel):
    notes: list[PlayerNoteResponse]
