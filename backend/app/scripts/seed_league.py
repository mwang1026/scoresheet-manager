#!/usr/bin/env python3
"""Seed league from environment variables."""

import os

from sqlalchemy.dialects.postgresql import insert

from app.models import League
from app.scripts import get_session, run_async


async def seed_league():
    """
    Seed league from environment variables.

    Reads from:
    - SEED_LEAGUE_NAME (default: "AL Catfish Hunter")
    - SEED_LEAGUE_SEASON (default: 2026)

    Creates or updates the league by name (unique natural key).
    """
    league_name = os.getenv("SEED_LEAGUE_NAME", "AL Catfish Hunter")
    league_season = int(os.getenv("SEED_LEAGUE_SEASON", "2026"))

    print(f"Seeding league: {league_name} (season {league_season})")

    async for session in get_session():
        # Upsert league by name
        stmt = insert(League.__table__).values(
            name=league_name,
            season=league_season,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["name"],
            set_={"season": stmt.excluded.season},
        )

        await session.execute(stmt)
        await session.commit()

        print(f"✓ Seeded league: {league_name}")


if __name__ == "__main__":
    run_async(seed_league())
