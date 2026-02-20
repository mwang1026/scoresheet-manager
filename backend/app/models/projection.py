from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class HitterProjection(Base):
    __tablename__ = "hitter_projections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # "PECOTA-50"
    season: Mapped[int] = mapped_column(Integer, nullable=False)  # 2026

    # Raw counting stats (int, default 0)
    pa: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    g: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ab: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    r: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    b1: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # singles
    b2: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # doubles
    b3: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # triples
    hr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    h: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rbi: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hbp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    so: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Rate stats — stored as Numeric (exact decimal), display-only
    avg: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    obp: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    slg: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    babip: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    # Advanced metrics (PECOTA-specific, NOT derivable)
    drc_plus: Mapped[int | None] = mapped_column(Integer, nullable=True)
    drb: Mapped[float | None] = mapped_column(Numeric(5, 1), nullable=True)
    drp: Mapped[float | None] = mapped_column(Numeric(5, 1), nullable=True)
    vorp: Mapped[float | None] = mapped_column(Numeric(5, 1), nullable=True)
    warp: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)

    # Metadata
    dc_fl: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    drp_str: Mapped[str | None] = mapped_column(String(50), nullable=True)
    comparables: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("player_id", "source", name="uq_hitter_proj_player_source"),)


class PitcherProjection(Base):
    __tablename__ = "pitcher_projections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # "PECOTA-50"
    season: Mapped[int] = mapped_column(Integer, nullable=False)  # 2026

    # Raw counting stats (int, default 0)
    w: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    l: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sv: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hld: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    g: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    qs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bf: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ip_outs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    h: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hbp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    so: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Rate stats — stored as Numeric, display-only
    era: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    whip: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    babip: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    bb9: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    so9: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    # Advanced metrics (PECOTA-specific, NOT derivable)
    fip: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    cfip: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dra: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    dra_minus: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warp: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    gb_percent: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)

    # Metadata
    dc_fl: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    comparables: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("player_id", "source", name="uq_pitcher_proj_player_source"),)
