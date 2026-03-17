"""Draft note schemas."""

from datetime import datetime

from pydantic import BaseModel


class DraftNoteUpsertRequest(BaseModel):
    content: str


class DraftNoteResponse(BaseModel):
    content: str
    updated_at: datetime

    model_config = {"from_attributes": True}
