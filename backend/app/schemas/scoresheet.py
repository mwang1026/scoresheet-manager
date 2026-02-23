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
