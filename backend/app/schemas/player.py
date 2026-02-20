"""Player schema definitions."""

from datetime import date
from pydantic import BaseModel


class PlayerPositionSchema(BaseModel):
    """Defensive position rating."""

    position: str
    rating: float

    model_config = {"from_attributes": True}


class PlayerBase(BaseModel):
    """Base player fields."""

    id: int
    first_name: str
    last_name: str
    primary_position: str
    current_mlb_team: str | None = None
    bats: str | None = None
    throws: str | None = None
    age: int | None = None

    model_config = {"from_attributes": True}


class PlayerListItem(PlayerBase):
    """Player list item - minimal fields for tables."""

    scoresheet_id: int
    mlb_id: int | None = None


class PlayerDetail(PlayerBase):
    """Player detail - comprehensive fields."""

    scoresheet_id: int
    mlb_id: int | None = None
    bp_id: int | None = None
    scoresheet_nl_id: int | None = None
    birthday: date | None = None
    height: int | None = None
    weight: int | None = None
    is_trade_bait: bool

    # Scoresheet-specific fields
    positions: list[PlayerPositionSchema] = []

    # Catcher steal rates (if applicable)
    osb_al: float | None = None
    ocs_al: float | None = None
    osb_nl: float | None = None
    ocs_nl: float | None = None

    # Batting splits (if applicable)
    ba_vr: int | None = None
    ob_vr: int | None = None
    sl_vr: int | None = None
    ba_vl: int | None = None
    ob_vl: int | None = None
    sl_vl: int | None = None


class PlayerListResponse(BaseModel):
    """Paginated player list response."""

    players: list[PlayerListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
