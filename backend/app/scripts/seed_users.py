#!/usr/bin/env python3
"""Seed users from environment variables.

IMPORTANT: This script replaces the old seed_user.py.

Reads from SEED_USERS env var with format: email:scoresheet_team_id:role (comma-separated).
Example: SEED_USERS=michael@gmail.com:1:admin,andrew@gmail.com:2:user

Creates/updates users and their user_teams associations.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.config import settings
from app.models import League, Team, User, UserTeam
from app.scripts import get_session, run_async


async def seed_users():
    """
    Seed users and user-team associations from environment variables.

    Reads from:
    - SEED_USERS: email:scoresheet_team_id:role (comma-separated)
    - SEED_LEAGUE_NAME: league name for team lookup (default: "AL Catfish Hunter")

    Example: SEED_USERS=michael@scoresheet.local:1:admin
    """
    seed_users_env = settings.SEED_USERS
    league_name = settings.SEED_LEAGUE_NAME

    if not seed_users_env:
        print("No SEED_USERS env var found. Skipping.")
        return

    # Parse SEED_USERS
    user_entries = []
    for entry in seed_users_env.split(","):
        parts = entry.strip().split(":")
        if len(parts) != 3:
            print(f"⚠ Skipping invalid entry: {entry}")
            continue

        email, scoresheet_team_id_str, role = parts
        try:
            scoresheet_team_id = int(scoresheet_team_id_str)
        except ValueError:
            print(f"⚠ Skipping invalid scoresheet_team_id: {scoresheet_team_id_str}")
            continue

        user_entries.append((email, scoresheet_team_id, role))

    if not user_entries:
        print("No valid user entries found. Skipping.")
        return

    print(f"Seeding {len(user_entries)} user(s) for league: {league_name}")

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

        # Process each user entry
        for email, scoresheet_team_id, role in user_entries:
            # Look up team by league_id + scoresheet_id
            team_result = await session.execute(
                select(Team.id).where(
                    Team.league_id == league_id,
                    Team.scoresheet_id == scoresheet_team_id,
                )
            )
            team_id = team_result.scalar_one_or_none()

            if not team_id:
                print(
                    f"✗ Team not found: scoresheet_id={scoresheet_team_id} in league={league_name}"
                )
                print("Run import_teams.py first!")
                continue

            # Upsert user
            user_stmt = insert(User.__table__).values(
                email=email,
                role=role,
            )
            user_stmt = user_stmt.on_conflict_do_update(
                index_elements=["email"],
                set_={"role": user_stmt.excluded.role},
            )

            result = await session.execute(user_stmt)
            await session.flush()

            # Get user_id (either inserted or updated)
            user_result = await session.execute(
                select(User.id).where(User.email == email)
            )
            user_id = user_result.scalar_one()

            # Upsert user_team association
            user_team_stmt = insert(UserTeam.__table__).values(
                user_id=user_id,
                team_id=team_id,
                role="owner",
            )
            user_team_stmt = user_team_stmt.on_conflict_do_nothing(
                index_elements=["user_id", "team_id"]
            )

            await session.execute(user_team_stmt)

            print(f"✓ Seeded user: {email} -> Team #{scoresheet_team_id}")

        await session.commit()
        print(f"\nSummary: Seeded {len(user_entries)} user(s)")


if __name__ == "__main__":
    run_async(seed_users())
