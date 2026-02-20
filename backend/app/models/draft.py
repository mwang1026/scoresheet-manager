from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class DraftSchedule(Base):
    __tablename__ = "draft_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pick_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), nullable=False)
    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_player_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("players.id"), nullable=True
    )
    picked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
