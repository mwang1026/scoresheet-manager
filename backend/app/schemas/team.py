"""Team schema definitions."""

from pydantic import BaseModel


class TeamListItem(BaseModel):
    """Team list item."""

    id: int
    name: str
    scoresheet_id: int
    is_my_team: bool

    model_config = {"from_attributes": True}


class TeamListResponse(BaseModel):
    """Team list response."""

    teams: list[TeamListItem]
