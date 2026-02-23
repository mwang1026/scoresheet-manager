"""Scoresheet scraper API schema definitions."""

from pydantic import BaseModel


class ScrapedLeagueItem(BaseModel):
    """A single scraped league."""

    name: str
    data_path: str


class ScrapedLeagueListResponse(BaseModel):
    """Response for the league list endpoint."""

    leagues: list[ScrapedLeagueItem]


class ScrapedTeamItem(BaseModel):
    """A single scraped team."""

    scoresheet_id: int
    owner_name: str


class ScrapedTeamListResponse(BaseModel):
    """Response for the team list endpoint."""

    data_path: str
    teams: list[ScrapedTeamItem]


class RosterRefreshResponse(BaseModel):
    """Response for the roster refresh endpoint."""

    league_id: int
    teams_processed: int
    players_added: int
    players_removed: int
    unresolved_pins: int


class OnboardRequest(BaseModel):
    """Request body for the onboard endpoint."""

    data_path: str
    scoresheet_team_id: int
    user_email: str


class OnboardRosterSummary(BaseModel):
    """Roster scrape summary nested inside OnboardResponse."""

    teams_processed: int
    players_added: int
    players_removed: int
    unresolved_pins: int


class OnboardResponse(BaseModel):
    """Response for the onboard endpoint."""

    league_id: int
    team_id: int
    team_name: str
    roster: OnboardRosterSummary
