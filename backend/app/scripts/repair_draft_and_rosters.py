"""One-shot repair: rerun roster + draft scrape for every league.

Use after deploying the player_roster (league_id, player_id) uniqueness
constraint to:
  - collapse any historical duplicate roster rows onto the constraint
    (the migration's pre-dedupe keeps lowest id; this run rewrites rows
     to match Scoresheet's current pin assignments)
  - repair draft_schedule.team_id / from_team_id for completed picks
    whose original projection (compute_upcoming_picks) diverged from
    the -T.js truth

Idempotent — safe to rerun.

Usage:
    python -m app.scripts.repair_draft_and_rosters
"""

import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.logging_config import setup_logging
from app.models import League
from app.scripts import run_async
from app.services.scoresheet_scraper import (
    scrape_and_persist_draft,
    scrape_and_persist_rosters,
)

setup_logging()
logger = logging.getLogger(__name__)


async def main() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(League)
            .where(League.scoresheet_data_path.isnot(None))
            .order_by(League.name)
        )
        leagues = result.scalars().all()
        logger.info("Repairing %d leagues", len(leagues))

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
                draft_summary = await scrape_and_persist_draft(
                    session, league, force=True
                )
                logger.info(
                    "  Draft: %d completed picks processed, %d unresolved",
                    draft_summary["completed_picks_processed"],
                    draft_summary["unresolved_players"],
                )
            except Exception as e:
                logger.warning("  Draft scrape failed: %s", e)

            if i < len(leagues) - 1:
                await asyncio.sleep(2)

    logger.info("Repair complete.")


if __name__ == "__main__":
    run_async(main())
