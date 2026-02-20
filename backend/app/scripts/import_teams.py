#!/usr/bin/env python3
"""Import teams from frontend fixtures."""

import json
import os
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from app.models import Team
from app.scripts import get_session, run_async


async def import_teams():
    """Import teams from frontend/lib/fixtures/teams.json."""
    # Locate the teams.json fixture
    backend_dir = Path(__file__).resolve().parent.parent.parent
    project_root = backend_dir.parent
    teams_json = project_root / "frontend" / "lib" / "fixtures" / "teams.json"

    if not teams_json.exists():
        raise FileNotFoundError(f"Teams fixture not found: {teams_json}")

    print(f"Reading teams from: {teams_json}")

    with open(teams_json) as f:
        teams_data = json.load(f)

    print(f"Found {len(teams_data)} teams")

    # Transform data to match model
    rows = [
        {
            "name": team["name"],
            "scoresheet_id": team["scoresheet_team_id"],
            "is_my_team": team["is_my_team"],
        }
        for team in teams_data
    ]

    # Upsert teams
    async for session in get_session():
        stmt = insert(Team.__table__).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["scoresheet_id"],
            set_={
                "name": stmt.excluded.name,
                "is_my_team": stmt.excluded.is_my_team,
            },
        )

        await session.execute(stmt)
        await session.commit()

        print(f"✓ Imported {len(rows)} teams")


if __name__ == "__main__":
    run_async(import_teams())
