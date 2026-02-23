from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leagues.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    scoresheet_id: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint("league_id", "scoresheet_id", name="uq_team_league_scoresheet"),
    )
