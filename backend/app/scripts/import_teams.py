#!/usr/bin/env python3
"""Import teams from frontend fixtures."""

import json
import logging
import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import League, Team
from app.scripts import get_session, run_async

logger = logging.getLogger(__name__)


async def import_teams():
    """
    Import teams from frontend/lib/fixtures/teams.json.

    Reads from:
    - SEED_LEAGUE_NAME: league name for team association (default: "AL Catfish Hunter")
    """
    league_name = os.getenv("SEED_LEAGUE_NAME", "AL Catfish Hunter")

    # Locate the teams.json fixture
    backend_dir = Path(__file__).resolve().parent.parent.parent
    project_root = backend_dir.parent
    teams_json = project_root / "frontend" / "lib" / "fixtures" / "teams.json"

    if not teams_json.exists():
        raise FileNotFoundError(f"Teams fixture not found: {teams_json}")

    logger.info("Reading teams from: %s", teams_json)
    logger.info("Target league: %s", league_name)

    with open(teams_json) as f:
        teams_data = json.load(f)

    logger.info("Found %d teams", len(teams_data))

    # Upsert teams
    async for session in get_session():
        # Look up league
        league_result = await session.execute(
            select(League.id).where(League.name == league_name)
        )
        league_id = league_result.scalar_one_or_none()

        if not league_id:
            logger.error("League not found: %s", league_name)
            logger.error("Run seed_league.py first!")
            return

        # Transform data to match model (drop is_my_team, add league_id)
        rows = [
            {
                "league_id": league_id,
                "name": team["name"],
                "scoresheet_id": team["scoresheet_team_id"],
            }
            for team in teams_data
        ]

        stmt = insert(Team.__table__).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["league_id", "scoresheet_id"],
            set_={"name": stmt.excluded.name},
        )

        await session.execute(stmt)
        await session.commit()

        logger.info("Imported %d teams for league: %s", len(rows), league_name)


if __name__ == "__main__":
    run_async(import_teams())
