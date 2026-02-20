from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    scoresheet_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    is_my_team: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
