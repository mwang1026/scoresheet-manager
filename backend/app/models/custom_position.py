from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class CustomPosition(Base):
    __tablename__ = "custom_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id"), nullable=False)
    position: Mapped[str] = mapped_column(String(5), nullable=False)

    __table_args__ = (
        UniqueConstraint("team_id", "player_id", "position", name="uq_custom_positions_team_player_pos"),
    )
