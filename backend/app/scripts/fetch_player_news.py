#!/usr/bin/env python3
"""
Fetch player news from RotoWire and persist to the database.

Usage:
    python -m app.scripts.fetch_player_news
"""

import logging

from app.logging_config import setup_logging

setup_logging()

from app.scripts import get_session, run_async
from app.services.news_scraper import scrape_and_persist_news

logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("Starting news scrape...")
    async for session in get_session():
        summary = await scrape_and_persist_news(session)
        logger.info("News scrape summary: %s", summary)


if __name__ == "__main__":
    run_async(main())
