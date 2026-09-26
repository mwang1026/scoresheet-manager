"""Scrape Score-It starting lineups for every league with a Scoresheet data path.

Idempotent: rows for the week the file covers are replaced; earlier weeks
are kept. Run daily (the file changes once a week when results post).

Usage:
    python -m app.scripts.scrape_lineups
"""

import logging

from sqlalchemy import select

from app.logging_config import setup_logging

setup_logging()

from app.database import AsyncSessionLocal
from app.models import League
from app.scripts import run_async
from app.services.scoresheet_scraper import scrape_and_persist_lineups

logger = logging.getLogger(__name__)


async def main() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(League).where(League.scoresheet_data_path.isnot(None)).order_by(League.name)
        )
        leagues = result.scalars().all()
        logger.info("Lineup scrape: %d leagues", len(leagues))

        failures = 0
        for i, league in enumerate(leagues):
            logger.info("[%d/%d] %s", i + 1, len(leagues), league.name)
            try:
                summary = await scrape_and_persist_lineups(session, league)
                logger.info(
                    "  week_end=%s games=%d rows=%d unresolved_pins=%d unassigned_subs=%d",
                    summary["week_end"],
                    summary["games"],
                    summary["rows_written"],
                    summary["unresolved_pins"],
                    summary["unassigned_subs"],
                )
            except Exception as e:
                failures += 1
                logger.warning("  Lineup scrape failed: %s", e)

        if failures:
            raise RuntimeError(f"Lineup scrape failed for {failures} league(s)")


if __name__ == "__main__":
    run_async(main())
