#!/usr/bin/env python3
"""Import teams from frontend fixtures."""

import json
import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import League, Team
from app.scripts import get_session, run_async


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

    print(f"Reading teams from: {teams_json}")
    print(f"Target league: {league_name}")

    with open(teams_json) as f:
        teams_data = json.load(f)

    print(f"Found {len(teams_data)} teams")

    # Upsert teams
    async for session in get_session():
        # Look up league
        league_result = await session.execute(
            select(League.id).where(League.name == league_name)
        )
        league_id = league_result.scalar_one_or_none()

        if not league_id:
            print(f"✗ League not found: {league_name}")
            print("Run seed_league.py first!")
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

        print(f"✓ Imported {len(rows)} teams for league: {league_name}")


if __name__ == "__main__":
    run_async(import_teams())
