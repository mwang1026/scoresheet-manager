"""Projection response schemas."""

from typing import Optional, Literal, Union
from pydantic import BaseModel, Field


class HitterProjectionAdvanced(BaseModel):
    """Advanced metrics for hitter projections."""
    avg: Optional[float] = None
    obp: Optional[float] = None
    slg: Optional[float] = None
    babip: Optional[float] = None
    drc_plus: Optional[int] = None
    vorp: Optional[float] = None
    warp: Optional[float] = None


class PitcherProjectionAdvanced(BaseModel):
    """Advanced metrics for pitcher projections."""
    era: Optional[float] = None
    whip: Optional[float] = None
    fip: Optional[float] = None
    dra: Optional[float] = None
    dra_minus: Optional[int] = None
    warp: Optional[float] = None
    gb_percent: Optional[float] = None


class HitterProjectionItem(BaseModel):
    """Single hitter projection entry."""
    player_id: int
    source: str
    player_type: Literal["hitter"] = "hitter"
    season: int

    # Counting stats
    g: int = 0
    pa: int = 0
    ab: int = 0
    r: int = 0
    h: int = 0
    single: int = Field(0, description="Singles")
    double: int = Field(0, description="Doubles")
    triple: int = Field(0, description="Triples")
    hr: int = 0
    rbi: int = 0
    bb: int = 0
    ibb: int = 0
    so: int = 0
    hbp: int = 0
    sf: int = 0
    sh: int = 0
    sb: int = 0
    cs: int = 0
    go: int = 0
    fo: int = 0
    gdp: int = 0

    # Advanced metrics (nullable)
    advanced: Optional[HitterProjectionAdvanced] = None


class PitcherProjectionItem(BaseModel):
    """Single pitcher projection entry."""
    player_id: int
    source: str
    player_type: Literal["pitcher"] = "pitcher"
    season: int

    # Counting stats
    g: int = 0
    gs: int = 0
    gf: int = 0
    cg: int = 0
    sho: int = 0
    w: int = 0
    l: int = 0
    sv: int = 0
    hld: int = 0
    ip_outs: int = Field(0, description="Innings pitched as outs (IP * 3)")
    h: int = 0
    r: int = 0
    er: int = Field(0, description="Earned runs (back-calculated from ERA)")
    hr: int = 0
    bb: int = 0
    ibb: int = 0
    so: int = 0
    hbp: int = 0
    wp: int = 0
    bk: int = 0

    # Advanced metrics (nullable)
    advanced: Optional[PitcherProjectionAdvanced] = None


class ProjectionListResponse(BaseModel):
    """Response containing list of projections."""
    projections: list[Union[HitterProjectionItem, PitcherProjectionItem]]
