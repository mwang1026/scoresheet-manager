"""Lineup API schema definitions."""

from datetime import date

from pydantic import BaseModel


class LineupSlot(BaseModel):
    """One batting-order slot in a derived lineup."""

    slot: int  # 0-8 batting order
    position: str  # C, 1B, ..., DH
    pin: int  # Scoresheet player id (kept for unresolved players, e.g. AAA fill-ins)
    player_id: int | None


class LineupPitcher(BaseModel):
    """A pitcher in the rotation or bullpen with usage count for the week."""

    pin: int
    player_id: int | None
    games: int


class TeamLineup(BaseModel):
    """Derived working lineup for one team."""

    team_id: int
    games: int
    unknown_hand_games: int  # games where the opposing SP's hand was unknown (bucketed as RHP)
    vs_rhp: list[LineupSlot] | None
    vs_lhp: list[LineupSlot] | None
    rotation: list[LineupPitcher]
    relievers: list[LineupPitcher]


class LineupsResponse(BaseModel):
    """Response for GET /api/lineups."""

    league_id: int
    week_end: date | None  # None when no lineups have been scraped yet
    teams: list[TeamLineup]


class LineupRefreshResponse(BaseModel):
    """Response for the lineup refresh endpoint."""

    league_id: int
    week_end: date | None
    games: int
    rows_written: int
    unresolved_pins: int
    unassigned_subs: int
