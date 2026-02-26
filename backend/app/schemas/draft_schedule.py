"""Draft schedule schemas."""

from pydantic import BaseModel


class DraftScheduleItem(BaseModel):
    """A single upcoming draft pick slot."""

    round: int
    pick_in_round: int
    team_id: int
    team_name: str
    from_team_name: str | None = None
    scheduled_time: str  # ISO 8601


class DraftScheduleResponse(BaseModel):
    """Response containing the draft schedule."""

    league_id: int
    draft_complete: bool
    last_scraped_at: str | None = None
    picks: list[DraftScheduleItem]


class DraftRefreshResponse(BaseModel):
    """Response after triggering a draft scrape."""

    league_id: int
    draft_complete: bool
    last_scraped_at: str | None = None
    picks: list[DraftScheduleItem]
    upcoming_picks: int
    completed_picks_processed: int
    players_rostered: int
    unresolved_players: int
    cooldown_skipped: bool
