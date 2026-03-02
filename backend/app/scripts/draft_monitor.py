"""Draft monitor cron: check for active draft activity, scrape if needed."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.logging_config import setup_logging

setup_logging()

from app.database import AsyncSessionLocal
from app.models import DraftSchedule, League
from app.scripts import run_async
from app.services.scoresheet_scraper import scrape_and_persist_draft

logger = logging.getLogger(__name__)

WINDOW = timedelta(minutes=10)


async def main():
    now = datetime.now(timezone.utc)
    window_start = now - WINDOW
    window_end = now + WINDOW

    async with AsyncSessionLocal() as session:
        # Find leagues with unpicked rows scheduled around now
        leagues_with_activity = await session.execute(
            select(DraftSchedule.league_id)
            .where(
                DraftSchedule.picked_player_id.is_(None),
                DraftSchedule.scheduled_at.between(window_start, window_end),
            )
            .distinct()
        )
        active_league_ids = [row[0] for row in leagues_with_activity.all()]

        if not active_league_ids:
            logger.info("No active draft windows. Exiting.")
            return

        # Load those leagues (skip draft_complete ones)
        result = await session.execute(
            select(League).where(
                League.id.in_(active_league_ids),
                League.draft_complete.is_(False),
            )
        )
        leagues = result.scalars().all()

        if not leagues:
            logger.info("All active leagues already draft_complete. Exiting.")
            return

        logger.info("Draft activity detected for %d league(s)", len(leagues))
        for league in leagues:
            try:
                summary = await scrape_and_persist_draft(session, league, force=True)
                logger.info(
                    "  %s: %d upcoming, %d completed, %d newly rostered",
                    league.name,
                    summary["upcoming_picks"],
                    summary["completed_picks_processed"],
                    summary["players_rostered"],
                )
            except Exception as e:
                logger.warning("  %s: draft scrape failed: %s", league.name, e)

    logger.info("Draft monitor complete.")


if __name__ == "__main__":
    run_async(main())
