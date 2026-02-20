from sqlalchemy import ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class PlayerPosition(Base):
    __tablename__ = "player_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id"), nullable=False, index=True
    )
    position: Mapped[str] = mapped_column(String(5), nullable=False)  # 1B, 2B, 3B, SS, OF
    rating: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)

    __table_args__ = (UniqueConstraint("player_id", "position", name="uq_player_position"),)
