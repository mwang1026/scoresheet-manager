from datetime import date
from enum import Enum

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class RosterStatus(str, Enum):
    ROSTERED = "rostered"
    AVAILABLE = "available"
    KEEPER = "keeper"
    DROPPED = "dropped"


class PlayerRoster(Base):
    __tablename__ = "player_roster"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id"), nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # See RosterStatus enum
    added_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    dropped_date: Mapped[date | None] = mapped_column(Date, nullable=True)
