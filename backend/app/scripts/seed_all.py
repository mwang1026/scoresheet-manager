#!/usr/bin/env python3
"""
One-command bootstrap: seed league, teams, users, and rosters.

Usage:
    cd backend
    alembic upgrade head
    python -m app.scripts.seed_all

Environment variables (all optional — defaults work for local dev):
    SEED_LEAGUE_NAME       League name          (default: "AL Catfish Hunter")
    SEED_LEAGUE_SEASON     Season year          (default: 2026)
    SEED_LEAGUE_DATA_PATH  Scoresheet path      (default: "FOR_WWW1/AL_Catfish_Hunter")
    SEED_USERS             User entries         (default: "user@example.com:1:owner")

Steps (in order):
    1. seed_league()  — upsert league with league_type + scoresheet_data_path
    2. import_teams() — upsert teams from frontend/lib/fixtures/teams.json
    3. seed_users()   — upsert users + UserTeam links
    4. scrape rosters — best-effort, warns and continues on failure
"""

import logging

from sqlalchemy import select

from app.models import League
from app.scripts import run_async
from app.scripts.import_teams import import_teams
from app.scripts.seed_league import seed_league
from app.scripts.seed_users import seed_users

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_all():
    """Run the full bootstrap sequence."""
    from app.config import settings

    league_name = settings.SEED_LEAGUE_NAME

    logger.info("=" * 60)
    logger.info("Scoresheet Manager — Full Bootstrap")
    logger.info("=" * 60)

    # Step 1: Seed league
    logger.info("[1/4] Seeding league...")
    await seed_league()

    # Step 2: Import teams
    logger.info("[2/4] Importing teams...")
    await import_teams()

    # Step 3: Seed users
    logger.info("[3/4] Seeding users...")
    await seed_users()

    # Step 4: Scrape and persist rosters (best-effort)
    logger.info("[4/4] Scraping rosters from Scoresheet.com...")
    try:
        from app.database import AsyncSessionLocal
        from app.services.scoresheet_scraper import scrape_and_persist_rosters

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(League).where(League.name == league_name)
            )
            league = result.scalar_one_or_none()

            if league is None:
                logger.warning("League '%s' not found after seeding — skipping rosters", league_name)
            elif not league.scoresheet_data_path:
                logger.warning("League has no scoresheet_data_path — skipping rosters")
            else:
                summary = await scrape_and_persist_rosters(session, league)
                logger.info(
                    "Rosters scraped: %d teams, +%d added, -%d removed, %d unresolved pins",
                    summary['teams_processed'], summary['players_added'],
                    summary['players_removed'], summary['unresolved_pins'],
                )
    except Exception as e:
        logger.warning("Roster scrape failed (non-fatal): %s", e)
        logger.warning("Run `python -m app.scripts.scrape_scoresheet` later to populate rosters.")

    logger.info("=" * 60)
    logger.info("Bootstrap complete.")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_async(seed_all())
