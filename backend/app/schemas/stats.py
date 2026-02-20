"""Stats schema definitions."""

from datetime import date
from pydantic import BaseModel


class HitterDailyStatsItem(BaseModel):
    """Raw daily hitter stats - mirrors database columns exactly."""

    player_id: int
    date: date

    # Core counting
    g: int
    pa: int
    ab: int
    h: int
    single: int
    double: int
    triple: int
    hr: int
    tb: int
    r: int
    rbi: int

    # Outs
    so: int
    go: int
    fo: int
    ao: int
    gdp: int

    # Plate discipline
    bb: int
    ibb: int
    hbp: int

    # Baserunning
    sb: int
    cs: int

    # Sacrifice
    sf: int
    sh: int

    # Situational
    lob: int

    # Pitch counts
    pitches: int

    model_config = {"from_attributes": True}


class PitcherDailyStatsItem(BaseModel):
    """Raw daily pitcher stats - mirrors database columns exactly."""

    player_id: int
    date: date

    # Games
    g: int
    gs: int
    gf: int
    cg: int
    sho: int

    # Saves/holds
    sv: int
    svo: int
    bs: int
    hld: int

    # Innings (stored as outs)
    ip_outs: int

    # Decisions
    w: int
    l: int

    # Runs
    er: int
    r: int

    # Batters faced
    bf: int
    ab: int

    # Hits/outcomes against
    h: int
    double: int
    triple: int
    hr: int
    tb: int

    # Walks
    bb: int
    ibb: int
    hbp: int

    # Strikeouts
    k: int

    # Batted ball outs
    go: int
    fo: int
    ao: int

    # Baserunning against
    sb: int
    cs: int

    # Sacrifice against
    sf: int
    sh: int

    # Control
    wp: int
    bk: int
    pk: int

    # Inherited runners
    ir: int
    irs: int

    # Pitch counts
    pitches: int
    strikes: int

    model_config = {"from_attributes": True}


class HitterStatsListResponse(BaseModel):
    """Response model for hitter stats list."""

    stats: list[HitterDailyStatsItem]


class PitcherStatsListResponse(BaseModel):
    """Response model for pitcher stats list."""

    stats: list[PitcherDailyStatsItem]
