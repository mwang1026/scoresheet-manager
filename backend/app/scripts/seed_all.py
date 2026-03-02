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
    1. scrape league + teams       — fetch from scoresheet.com, upsert league and teams
    2. seed_users()                — upsert users + UserTeam links
    3. fetch_scoresheet_players    — import player list (subprocess, needed for roster/draft resolution)
    4. scrape rosters              — best-effort, warns and continues on failure
    5. scrape draft                — best-effort, warns and continues on failure
"""

import logging
import subprocess
import sys

import httpx
from sqlalchemy import select

from app.models import League
from app.scripts import run_async
from app.scripts.seed_users import seed_users
from app.services.scoresheet_scraper.service import (
    fetch_league_teams,
    persist_league_and_teams,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_all():
    """Run the full bootstrap sequence."""
    from app.config import settings
    from app.database import AsyncSessionLocal

    league_name = settings.SEED_LEAGUE_NAME
    data_path = settings.SEED_LEAGUE_DATA_PATH
    season = settings.SEED_LEAGUE_SEASON

    logger.info("=" * 60)
    logger.info("Scoresheet Manager — Full Bootstrap")
    logger.info("=" * 60)

    # Step 1: Scrape league + teams from scoresheet.com
    logger.info("[1/5] Scraping league and teams from scoresheet.com...")
    async with httpx.AsyncClient() as client:
        teams = await fetch_league_teams(client, data_path)
    logger.info("Found %d teams for %s", len(teams), league_name)
    async with AsyncSessionLocal() as session:
        league = await persist_league_and_teams(session, league_name, data_path, teams, season)
    logger.info("League and teams persisted (league_id=%d)", league.id)

    # Step 2: Seed users
    logger.info("[2/5] Seeding users...")
    await seed_users()

    # Step 3: Fetch Scoresheet player list (needed for roster/draft resolution)
    logger.info("[3/5] Fetching Scoresheet player list...")
    player_result = subprocess.run([sys.executable, "-m", "app.scripts.fetch_scoresheet_players"])
    if player_result.returncode != 0:
        logger.warning("Player fetch failed (exit %d) — rosters/draft may have unresolved pins",
                        player_result.returncode)

    # Step 4: Scrape and persist rosters (best-effort)
    logger.info("[4/5] Scraping rosters from Scoresheet.com...")
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

    # Step 5: Scrape and persist draft schedule (best-effort)
    logger.info("[5/5] Scraping draft schedule from Scoresheet.com...")
    try:
        from app.database import AsyncSessionLocal as _ASL2
        from app.services.scoresheet_scraper import scrape_and_persist_draft

        async with _ASL2() as session:
            result = await session.execute(
                select(League).where(League.name == league_name)
            )
            league = result.scalar_one_or_none()

            if league is None:
                logger.warning("League '%s' not found — skipping draft scrape", league_name)
            elif not league.scoresheet_data_path:
                logger.warning("League has no scoresheet_data_path — skipping draft scrape")
            else:
                summary = await scrape_and_persist_draft(session, league, force=True)
                logger.info(
                    "Draft scraped: %d upcoming picks, %d completed processed, %d rostered",
                    summary["upcoming_picks"],
                    summary["completed_picks_processed"],
                    summary["players_rostered"],
                )
    except Exception as e:
        logger.warning("Draft scrape failed (non-fatal): %s", e)

    logger.info("=" * 60)
    logger.info("Bootstrap complete.")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_async(seed_all())
