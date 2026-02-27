from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class HitterDailyStats(Base):
    __tablename__ = "hitter_daily_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)

    # Core counting
    g: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pa: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ab: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    h: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    single: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    double: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    triple: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    r: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rbi: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Outs
    so: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    go: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ao: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gdp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Plate discipline
    bb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ibb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hbp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Baserunning
    sb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Sacrifice
    sf: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sh: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Situational
    lob: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("player_id", "date", name="uq_hitter_player_date"),
        Index("ix_hitter_player_date", "player_id", "date"),
        Index("ix_hitter_date", "date"),
    )
