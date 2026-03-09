from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic can detect them
from app.models.custom_position import CustomPosition
from app.models.draft_queue import DraftQueue
from app.models.draft_schedule import DraftSchedule
from app.models.hitter_daily_stats import HitterDailyStats
from app.models.league import League
from app.models.pitcher_daily_stats import PitcherDailyStats
from app.models.player import Player
from app.models.player_news import PlayerNews
from app.models.player_note import PlayerNote
from app.models.player_position import PlayerPosition
from app.models.player_roster import PlayerRoster, RosterStatus
from app.models.projection import HitterProjection, PitcherProjection
from app.models.team import Team
from app.models.user import User
from app.models.user_settings import UserSettings
from app.models.user_team import UserTeam
from app.models.watchlist import Watchlist

__all__ = [
    "Base",
    "CustomPosition",
    "DraftQueue",
    "DraftSchedule",
    "HitterDailyStats",
    "HitterProjection",
    "League",
    "PitcherDailyStats",
    "PitcherProjection",
    "Player",
    "PlayerNews",
    "PlayerNote",
    "PlayerPosition",
    "PlayerRoster",
    "RosterStatus",
    "Team",
    "User",
    "UserSettings",
    "UserTeam",
    "Watchlist",
]
