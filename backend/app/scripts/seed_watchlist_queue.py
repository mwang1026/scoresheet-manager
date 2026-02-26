#!/usr/bin/env python3
"""Seed watchlist and draft queue for development."""

import logging
import os

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import DraftQueue, Player, Watchlist
from app.scripts import get_session, run_async

logger = logging.getLogger(__name__)


async def seed_watchlist_queue():
    """
    Seed watchlist (30 players) and draft queue (10 players) for default team.

    Reads from:
    - DEFAULT_TEAM_ID: team ID to seed data for (default: 1)
    """
    team_id = int(os.getenv("DEFAULT_TEAM_ID", "1"))

    logger.info("Seeding watchlist and draft queue for team_id=%d", team_id)

    async for session in get_session():
        # Get 20 hitters (only Scoresheet league players)
        hitters_result = await session.execute(
            select(Player.id)
            .where(Player.scoresheet_only())
            .where(Player.primary_position != "P")
            .order_by(Player.last_name, Player.first_name)
            .limit(20)
        )
        hitter_ids = [row[0] for row in hitters_result.fetchall()]

        # Get 10 pitchers (only Scoresheet league players)
        pitchers_result = await session.execute(
            select(Player.id)
            .where(Player.scoresheet_only())
            .where(Player.primary_position == "P")
            .order_by(Player.last_name, Player.first_name)
            .limit(10)
        )
        pitcher_ids = [row[0] for row in pitchers_result.fetchall()]

        watchlist_player_ids = hitter_ids + pitcher_ids
        logger.info("Selected %d hitters and %d pitchers for watchlist", len(hitter_ids), len(pitcher_ids))

        # Pick queue subset: first 5 hitters + first 5 pitchers
        queue_player_ids = hitter_ids[:5] + pitcher_ids[:5]
        logger.info("Selected %d players for draft queue", len(queue_player_ids))

        # Insert watchlist (idempotent)
        watchlist_rows = [
            {"team_id": team_id, "player_id": player_id}
            for player_id in watchlist_player_ids
        ]

        stmt = insert(Watchlist.__table__).values(watchlist_rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["team_id", "player_id"]
        )
        result = await session.execute(stmt)
        logger.info("Inserted %d new watchlist entries", result.rowcount)

        # Insert draft queue with rank (idempotent)
        queue_rows = [
            {"team_id": team_id, "player_id": player_id, "rank": idx}
            for idx, player_id in enumerate(queue_player_ids)
        ]

        stmt = insert(DraftQueue.__table__).values(queue_rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["team_id", "player_id"]
        )
        result = await session.execute(stmt)
        logger.info("Inserted %d new draft queue entries", result.rowcount)

        await session.commit()

        logger.info("Summary:")
        logger.info("  Watchlist: %d players (%d hitters, %d pitchers)", len(watchlist_player_ids), len(hitter_ids), len(pitcher_ids))
        logger.info("  Queue: %d players (subset of watchlist)", len(queue_player_ids))


if __name__ == "__main__":
    run_async(seed_watchlist_queue())
