"""Custom position schemas."""

from pydantic import BaseModel


class CustomPositionAddRequest(BaseModel):
    player_id: int
    position: str


class CustomPositionsResponse(BaseModel):
    positions: dict[int, list[str]]
