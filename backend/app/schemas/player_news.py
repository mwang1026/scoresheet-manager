"""Player news schemas."""

from datetime import datetime

from pydantic import BaseModel


class PlayerNewsResponse(BaseModel):
    id: int
    player_id: int | None
    source: str
    headline: str
    url: str
    published_at: datetime
    body: str | None
    raw_player_name: str | None
    match_method: str | None

    model_config = {"from_attributes": True}


class NewsFlags(BaseModel):
    player_ids: list[int]


class DashboardNewsItem(BaseModel):
    id: int
    player_id: int | None
    headline: str
    body: str | None
    url: str
    published_at: datetime
    raw_player_name: str | None
    source: str

    model_config = {"from_attributes": True}
