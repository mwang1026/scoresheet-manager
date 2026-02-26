"""Player note schemas."""

from datetime import datetime

from pydantic import BaseModel


class PlayerNoteUpsertRequest(BaseModel):
    content: str


class PlayerNoteResponse(BaseModel):
    player_id: int
    content: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamNotesResponse(BaseModel):
    notes: dict[int, str]
