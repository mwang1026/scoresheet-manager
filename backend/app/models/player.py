from datetime import date
from sqlalchemy import Boolean, CheckConstraint, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (
        CheckConstraint(
            "scoresheet_id IS NOT NULL OR mlb_id IS NOT NULL",
            name="check_has_identifier"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # External IDs
    mlb_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # Not unique - two-way players have multiple entries
    scoresheet_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True, index=True)
    bp_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # Not unique - same reason
    scoresheet_nl_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Basic info
    primary_position: Mapped[str] = mapped_column(String(5), nullable=False)
    bats: Mapped[str | None] = mapped_column(String(1), nullable=True)
    throws: Mapped[str | None] = mapped_column(String(1), nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)  # inches
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)  # lbs
    current_mlb_team: Mapped[str | None] = mapped_column(String(5), nullable=True)
    is_trade_bait: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Scoresheet catcher steal rates (catchers only)
    osb_al: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    ocs_al: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    osb_nl: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    ocs_nl: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)

    # Scoresheet batting split adjustments (hitters only)
    ba_vr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ob_vr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sl_vr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ba_vl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ob_vl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sl_vl: Mapped[int | None] = mapped_column(Integer, nullable=True)
