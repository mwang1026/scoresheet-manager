"""Draft schedule model — upcoming pick slots with computed times."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class DraftSchedule(Base):
    __tablename__ = "draft_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leagues.id", ondelete="CASCADE"), nullable=False
    )
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    pick_in_round: Mapped[int] = mapped_column(Integer, nullable=False)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=False
    )
    from_team_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=True
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    picked_player_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("players.id"), nullable=True, default=None
    )

    __table_args__ = (
        UniqueConstraint("league_id", "round", "pick_in_round", name="uq_draft_schedule_league_round_pick"),
        Index("ix_draft_schedule_league_time", "league_id", "scheduled_at"),
    )
