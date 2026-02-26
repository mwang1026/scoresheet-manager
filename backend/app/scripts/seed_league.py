#!/usr/bin/env python3
"""Seed league from environment variables."""

import logging

from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.models import League
from app.scripts import get_session, run_async
from app.services.scoresheet_scraper import derive_league_type

logger = logging.getLogger(__name__)


async def seed_league():
    """
    Seed league from config settings (reads SEED_LEAGUE_NAME, SEED_LEAGUE_SEASON,
    SEED_LEAGUE_DATA_PATH from environment / .env via app.config).

    Creates or updates the league by name (unique natural key).
    """
    league_name = settings.SEED_LEAGUE_NAME
    league_season = settings.SEED_LEAGUE_SEASON
    league_data_path = settings.SEED_LEAGUE_DATA_PATH

    try:
        league_type = derive_league_type(league_name)
    except ValueError:
        league_type = None

    logger.info("Seeding league: %s (season %s, type %s, data_path %s)", league_name, league_season, league_type, league_data_path)

    async for session in get_session():
        # Upsert league by name
        stmt = insert(League.__table__).values(
            name=league_name,
            season=league_season,
            league_type=league_type,
            scoresheet_data_path=league_data_path,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["name"],
            set_={
                "season": stmt.excluded.season,
                "league_type": stmt.excluded.league_type,
                "scoresheet_data_path": stmt.excluded.scoresheet_data_path,
            },
        )

        await session.execute(stmt)
        await session.commit()

        logger.info("Seeded league: %s", league_name)


if __name__ == "__main__":
    run_async(seed_league())
