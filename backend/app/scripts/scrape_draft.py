#!/usr/bin/env python3
"""
Scrape draft schedule data from Scoresheet.com.

Fetches league JS + transactions JS, parses draft config and completed picks,
computes upcoming pick schedule with times, and persists to draft_schedule table.

Usage:
    cd backend
    python -m app.scripts.scrape_draft                  # all leagues
    python -m app.scripts.scrape_draft --league "AL Catfish Hunter"  # specific league

Uses force=True to bypass the 30-minute cooldown.
Sequential with 2-3s delay between leagues.
"""

import argparse
import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import League
from app.scripts import run_async
from app.services.scoresheet_scraper import scrape_and_persist_draft

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def scrape_draft(league_name: str | None = None):
    """Scrape draft for all leagues (or a specific one)."""
    async with AsyncSessionLocal() as session:
        query = select(League).where(League.scoresheet_data_path.isnot(None))
        if league_name:
            query = query.where(League.name == league_name)
        query = query.order_by(League.name)

        result = await session.execute(query)
        leagues = result.scalars().all()

        if not leagues:
            logger.warning("No leagues found%s", f" matching '{league_name}'" if league_name else "")
            return

        logger.info("Scraping draft for %d league(s)...", len(leagues))

        for i, league in enumerate(leagues):
            logger.info(
                "[%d/%d] Scraping draft for %s (%s)...",
                i + 1,
                len(leagues),
                league.name,
                league.scoresheet_data_path,
            )
            try:
                summary = await scrape_and_persist_draft(session, league, force=True)
                logger.info(
                    "  %d upcoming picks, %d completed processed, %d rostered, %d unresolved",
                    summary["upcoming_picks"],
                    summary["completed_picks_processed"],
                    summary["players_rostered"],
                    summary["unresolved_players"],
                )
            except Exception as e:
                logger.warning("  Failed: %s", e)

            # Delay between leagues to avoid hammering scoresheet.com
            if i < len(leagues) - 1:
                await asyncio.sleep(2)

    logger.info("Draft scrape complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Scoresheet draft data")
    parser.add_argument("--league", type=str, help="Specific league name to scrape")
    args = parser.parse_args()
    run_async(scrape_draft(args.league))
