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
    import os

    league_name = os.getenv("SEED_LEAGUE_NAME", "AL Catfish Hunter")

    print("=" * 60)
    print("Scoresheet Manager — Full Bootstrap")
    print("=" * 60)

    # Step 1: Seed league
    print("\n[1/4] Seeding league...")
    await seed_league()

    # Step 2: Import teams
    print("\n[2/4] Importing teams...")
    await import_teams()

    # Step 3: Seed users
    print("\n[3/4] Seeding users...")
    await seed_users()

    # Step 4: Scrape and persist rosters (best-effort)
    print("\n[4/4] Scraping rosters from Scoresheet.com...")
    try:
        from app.database import AsyncSessionLocal
        from app.services.scoresheet_scraper import scrape_and_persist_rosters

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(League).where(League.name == league_name)
            )
            league = result.scalar_one_or_none()

            if league is None:
                print(f"⚠ League '{league_name}' not found after seeding — skipping rosters")
            elif not league.scoresheet_data_path:
                print("⚠ League has no scoresheet_data_path — skipping rosters")
            else:
                summary = await scrape_and_persist_rosters(session, league)
                print(
                    f"✓ Rosters scraped: {summary['teams_processed']} teams, "
                    f"+{summary['players_added']} added, "
                    f"-{summary['players_removed']} removed, "
                    f"{summary['unresolved_pins']} unresolved pins"
                )
    except Exception as e:
        print(f"⚠ Roster scrape failed (non-fatal): {e}")
        print("  Run `python -m app.scripts.scrape_scoresheet` later to populate rosters.")

    print("\n" + "=" * 60)
    print("Bootstrap complete.")
    print("=" * 60)


if __name__ == "__main__":
    run_async(seed_all())
