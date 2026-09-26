"""Scraped Scoresheet game lineups (raw data from the Score-It file).

One row per lineup token per team per game: the nine starters plus the
starting pitcher (``is_starter=True``), and any in-game substitutions that
could be attributed to a team (``is_starter=False``). Nothing here is
calculated — derived lineups (modal batting order vs L/R, rotation) are
computed on read in ``app.services.lineups``.
"""

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class GameLineup(Base):
    __tablename__ = "game_lineups"
    __table_args__ = (
        UniqueConstraint(
            "league_id", "week_end", "game_no", "team_id", "seq",
            name="uq_game_lineup_slot",
        ),
        Index("ix_game_lineups_league_week", "league_id", "week_end"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    league_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leagues.id"), nullable=False
    )
    # Last day of the Scoresheet week the file covers (thru_date_).
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    game_no: Mapped[int] = mapped_column(Integer, nullable=False)  # order in file
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id"), nullable=False)
    opponent_team_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teams.id"), nullable=False
    )
    is_home: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Token order within the game for this team (starters first, then subs).
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    slot: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-8 hitters, 9 = SP
    position_code: Mapped[int] = mapped_column(Integer, nullable=False)
    pin: Mapped[int] = mapped_column(Integer, nullable=False)  # Scoresheet player id
    player_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("players.id"), nullable=True
    )
    is_starter: Mapped[bool] = mapped_column(Boolean, nullable=False)
