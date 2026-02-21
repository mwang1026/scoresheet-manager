#!/usr/bin/env python3
"""Seed watchlist and draft queue for development."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.models import DraftQueue, Player, Watchlist
from app.scripts import get_session, run_async


async def seed_watchlist_queue():
    """Seed watchlist (30 players) and draft queue (10 players) for user_id=1."""
    async for session in get_session():
        # Get 20 hitters (only Scoresheet league players)
        hitters_result = await session.execute(
            select(Player.id)
            .where(Player.scoresheet_id.isnot(None))
            .where(Player.primary_position != "P")
            .order_by(Player.last_name, Player.first_name)
            .limit(20)
        )
        hitter_ids = [row[0] for row in hitters_result.fetchall()]

        # Get 10 pitchers (only Scoresheet league players)
        pitchers_result = await session.execute(
            select(Player.id)
            .where(Player.scoresheet_id.isnot(None))
            .where(Player.primary_position == "P")
            .order_by(Player.last_name, Player.first_name)
            .limit(10)
        )
        pitcher_ids = [row[0] for row in pitchers_result.fetchall()]

        watchlist_player_ids = hitter_ids + pitcher_ids
        print(f"Selected {len(hitter_ids)} hitters and {len(pitcher_ids)} pitchers for watchlist")

        # Pick queue subset: first 5 hitters + first 5 pitchers
        queue_player_ids = hitter_ids[:5] + pitcher_ids[:5]
        print(f"Selected {len(queue_player_ids)} players for draft queue")

        # Insert watchlist (idempotent)
        watchlist_rows = [
            {"user_id": 1, "player_id": player_id}
            for player_id in watchlist_player_ids
        ]

        stmt = insert(Watchlist.__table__).values(watchlist_rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["user_id", "player_id"]
        )
        result = await session.execute(stmt)
        print(f"✓ Inserted {result.rowcount} new watchlist entries")

        # Insert draft queue with rank (idempotent)
        queue_rows = [
            {"user_id": 1, "player_id": player_id, "rank": idx}
            for idx, player_id in enumerate(queue_player_ids)
        ]

        stmt = insert(DraftQueue.__table__).values(queue_rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["user_id", "player_id"]
        )
        result = await session.execute(stmt)
        print(f"✓ Inserted {result.rowcount} new draft queue entries")

        await session.commit()

        print(f"\nSummary:")
        print(f"  Watchlist: {len(watchlist_player_ids)} players ({len(hitter_ids)} hitters, {len(pitcher_ids)} pitchers)")
        print(f"  Queue: {len(queue_player_ids)} players (subset of watchlist)")


if __name__ == "__main__":
    run_async(seed_watchlist_queue())
