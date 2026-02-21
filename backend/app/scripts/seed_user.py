#!/usr/bin/env python3
"""Seed default user for development."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import Team, User
from app.scripts import get_session, run_async


async def seed_user():
    """Seed default user (michael@scoresheet.local) linked to Team #1."""
    async for session in get_session():
        # Get Team #1's database ID (scoresheet_id=1)
        team_result = await session.execute(
            select(Team.id).where(Team.scoresheet_id == 1)
        )
        team_id = team_result.scalar_one()

        print(f"Found Team #1 with database ID: {team_id}")

        # Upsert user
        stmt = insert(User.__table__).values(
            id=1,
            email="michael@scoresheet.local",
            team_id=team_id,
            role="admin",
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["email"],
            set_={
                "team_id": stmt.excluded.team_id,
                "role": stmt.excluded.role,
            },
        )

        await session.execute(stmt)
        await session.commit()

        print("✓ Seeded default user (michael@scoresheet.local)")


if __name__ == "__main__":
    run_async(seed_user())
