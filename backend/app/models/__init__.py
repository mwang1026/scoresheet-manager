from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic can detect them
from app.models.draft import DraftSchedule
from app.models.draft_queue import DraftQueue
from app.models.hitter_daily_stats import HitterDailyStats
from app.models.pitcher_daily_stats import PitcherDailyStats
from app.models.player import Player
from app.models.player_news import PlayerNews
from app.models.player_position import PlayerPosition
from app.models.player_roster import PlayerRoster
from app.models.projection import HitterProjection, PitcherProjection
from app.models.team import Team
from app.models.user import User
from app.models.watchlist import Watchlist

__all__ = [
    "Base",
    "DraftQueue",
    "DraftSchedule",
    "HitterDailyStats",
    "HitterProjection",
    "PitcherDailyStats",
    "PitcherProjection",
    "Player",
    "PlayerNews",
    "PlayerPosition",
    "PlayerRoster",
    "Team",
    "User",
    "Watchlist",
]
