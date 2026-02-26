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


class MyTeamItem(BaseModel):
    """A team belonging to the current user, with league info."""

    id: int
    name: str
    scoresheet_id: int
    league_id: int
    league_name: str
    league_season: int
    league_scoresheet_data_path: str | None = None
    role: str


class MyTeamsResponse(BaseModel):
    """Response for the current user's teams."""

    teams: list[MyTeamItem]


class AddTeamRequest(BaseModel):
    """Request body for adding a team association to the current user."""

    data_path: str
    scoresheet_team_id: int
