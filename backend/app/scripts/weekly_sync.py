"""Weekly cron: sync players, rosters, and draft config for all leagues."""

import asyncio
import logging
import subprocess
import sys

from sqlalchemy import select

from app.logging_config import setup_logging

setup_logging()

from app.database import AsyncSessionLocal
from app.models import League
from app.scripts import run_async
from app.services.scoresheet_scraper import (
    scrape_and_persist_draft,
    scrape_and_persist_rosters,
)

logger = logging.getLogger(__name__)


async def main():
    # Step 0: Refresh player list (sync script, run as subprocess)
    logger.info("Refreshing Scoresheet player list...")
    result = subprocess.run([sys.executable, "-m", "app.scripts.fetch_scoresheet_players"])
    if result.returncode != 0:
        logger.error("fetch_scoresheet_players failed (exit %d)", result.returncode)
        sys.exit(result.returncode)

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(League).where(League.scoresheet_data_path.isnot(None)).order_by(League.name)
        )
        leagues = result.scalars().all()
        logger.info("Weekly sync: %d leagues", len(leagues))

        for i, league in enumerate(leagues):
            logger.info("[%d/%d] %s", i + 1, len(leagues), league.name)

            try:
                roster_summary = await scrape_and_persist_rosters(session, league)
                logger.info(
                    "  Rosters: +%d -%d, %d unresolved",
                    roster_summary["players_added"],
                    roster_summary["players_removed"],
                    roster_summary["unresolved_pins"],
                )
            except Exception as e:
                logger.warning("  Roster scrape failed: %s", e)

            try:
                draft_summary = await scrape_and_persist_draft(session, league, force=True)
                logger.info(
                    "  Draft: %d upcoming, %d completed, %d rostered",
                    draft_summary["upcoming_picks"],
                    draft_summary["completed_picks_processed"],
                    draft_summary["players_rostered"],
                )
            except Exception as e:
                logger.warning("  Draft scrape failed: %s", e)

            if i < len(leagues) - 1:
                await asyncio.sleep(2)

    logger.info("Weekly sync complete.")


if __name__ == "__main__":
    run_async(main())
