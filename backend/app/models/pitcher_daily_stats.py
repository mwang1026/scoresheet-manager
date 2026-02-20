from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class PitcherDailyStats(Base):
    __tablename__ = "pitcher_daily_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    # Games
    g: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gf: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cg: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sho: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Saves/holds
    sv: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    svo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hld: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Innings
    ip_outs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Decisions
    w: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    l: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Runs
    er: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    r: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Batters faced
    bf: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ab: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Hits/outcomes against
    h: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    double: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    triple: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Walks
    bb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ibb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hbp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Strikeouts
    k: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Batted ball outs
    go: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ao: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Baserunning against
    sb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Sacrifice against
    sf: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sh: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Control
    wp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bk: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pk: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Inherited runners (reliever-specific)
    ir: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    irs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Pitch counts
    pitches: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    strikes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("player_id", "date", name="uq_pitcher_player_date"),
        Index("ix_pitcher_player_date", "player_id", "date"),
        Index("ix_pitcher_date", "date"),
    )
