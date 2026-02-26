"""League model."""

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class League(Base):
    """Fantasy baseball league."""

    __tablename__ = "leagues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    season: Mapped[int] = mapped_column(Integer, nullable=False)
    scoresheet_data_path: Mapped[str | None] = mapped_column(String(200), nullable=True)
    league_type: Mapped[str | None] = mapped_column(String(2), nullable=True)  # AL, NL, or BL
    draft_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
