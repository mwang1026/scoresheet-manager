"""Team schema definitions."""

from pydantic import BaseModel


class TeamListItem(BaseModel):
    """Team list item."""

    id: int
    league_id: int
    league_name: str
    name: str
    scoresheet_id: int
    is_my_team: bool  # Computed field for backward compatibility

    model_config = {"from_attributes": True}


class TeamListResponse(BaseModel):
    """Team list response."""

    teams: list[TeamListItem]
