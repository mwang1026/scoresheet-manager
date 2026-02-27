"""
News scraper package.

Fetches player news from RotoWire, matches to Scoresheet players,
and persists to the player_news table.
"""

from .matcher import MatchMethod, MatchResult, match_player, match_players_batch
from .parser import ROTOWIRE_TEAM_MAP, ScrapedNewsItem, parse_news_page
from .service import NEWS_URL, scrape_and_persist_news

__all__ = [
    "MatchMethod",
    "MatchResult",
    "NEWS_URL",
    "ROTOWIRE_TEAM_MAP",
    "ScrapedNewsItem",
    "match_player",
    "match_players_batch",
    "parse_news_page",
    "scrape_and_persist_news",
]
