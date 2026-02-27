"""
Fetch MLB boxscores and save as JSON fixtures for database seeding.

Usage (daily cron - defaults to yesterday):
    python -m app.scripts.fetch_mlb_boxscores

Usage (single date):
    python -m app.scripts.fetch_mlb_boxscores --date 04/15/2026

Usage (backfill date range):
    python -m app.scripts.fetch_mlb_boxscores --start 04/01/2026 --end 04/30/2026

This script:
1. Builds mlb_id → player_id lookup from ALL players in the database
2. Fetches game schedules and boxscores from MLB Stats API
3. Creates stub Player records for unknown MLB IDs found in boxscores
4. Aggregates stats for doubleheaders (same player, multiple games per day)
5. Saves results to data/mlb-stats/hitter_daily_stats.json and pitcher_daily_stats.json

Output format is compatible with seed_daily_stats.py for database ingestion.
Designed for both daily cron jobs and multi-day backfills.
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import select

from app.config import settings
from app.constants import is_pitcher_position
from app.database import SessionLocal
from app.models import Player
from app.services.mlb_stats_api import (
    aggregate_stats_by_player_date,
    fetch_daily_boxscores,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Output directory
DATA_DIR = Path(__file__).parent.parent.parent.parent / "data" / "mlb-stats"


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Fetch MLB boxscores and save as JSON fixtures"
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Single date in MM/DD/YYYY format (default: yesterday)",
    )
    parser.add_argument(
        "--start",
        type=str,
        default=None,
        help="Start date in MM/DD/YYYY format (for multi-day backfills)",
    )
    parser.add_argument(
        "--end",
        type=str,
        default=None,
        help="End date in MM/DD/YYYY format (for multi-day backfills)",
    )
    parser.add_argument(
        "--season",
        type=int,
        default=settings.SEED_LEAGUE_SEASON,
        help=f"Season year for logging (default: {settings.SEED_LEAGUE_SEASON})",
    )
    return parser.parse_args()


def get_date_range(args) -> List[str]:
    """
    Resolve CLI args into a list of YYYY-MM-DD date strings.

    Priority: --start/--end > --date > yesterday.
    """
    if args.start and args.end:
        start_dt = datetime.strptime(args.start, "%m/%d/%Y")
        end_dt = datetime.strptime(args.end, "%m/%d/%Y")
    elif args.date:
        start_dt = datetime.strptime(args.date, "%m/%d/%Y")
        end_dt = start_dt
    else:
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        start_dt = yesterday
        end_dt = yesterday

    dates = []
    current = start_dt
    while current <= end_dt:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


def build_mlb_id_lookup(db) -> Dict[int, Dict[str, int]]:
    """
    Build mlb_id → player_id lookup from ALL players with mlb_id.

    Includes both Scoresheet players and PECOTA-only players — we want
    stats for every MLB player in our database.

    Two-way players (same mlb_id, different positions) get both
    "hitter" and "pitcher" entries pointing to their respective player_ids.

    Returns:
        {mlb_id: {"hitter": player_id, "pitcher": player_id}}
    """
    stmt = select(Player).where(Player.mlb_id.isnot(None))
    players = db.execute(stmt).scalars().all()

    lookup: Dict[int, Dict[str, int]] = {}
    for player in players:
        mlb_id = player.mlb_id
        if mlb_id not in lookup:
            lookup[mlb_id] = {}

        if is_pitcher_position(player.primary_position):
            lookup[mlb_id]["pitcher"] = player.id
        else:
            lookup[mlb_id]["hitter"] = player.id

    logger.info(
        f"Built lookup for {len(lookup)} unique MLB IDs "
        f"from {len(players)} player records"
    )
    return lookup


def create_stub_players(
    unknown_info: Dict[int, Dict[str, str]], db
) -> Dict[int, int]:
    """
    Create minimal Player records for unknown MLB IDs found in boxscores.

    Stubs have: mlb_id, first_name, last_name, primary_position.
    No scoresheet_id (these are non-Scoresheet MLB players).

    Args:
        unknown_info: {mlb_id: {"first_name": ..., "last_name": ..., "position": ...}}
        db: Sync database session

    Returns:
        {mlb_id: new_player_id}
    """
    if not unknown_info:
        return {}

    new_ids: Dict[int, int] = {}
    for mlb_id, info in unknown_info.items():
        player = Player(
            mlb_id=mlb_id,
            first_name=info["first_name"],
            last_name=info["last_name"],
            primary_position=info["position"] or "DH",
        )
        db.add(player)
        db.flush()  # Get auto-generated ID
        new_ids[mlb_id] = player.id

    db.commit()
    logger.info(f"Created {len(new_ids)} stub player records")
    return new_ids


def resolve_unknown_stats(
    stats: List[Dict[str, Any]], mlb_id_to_player_id: Dict[int, int]
) -> List[Dict[str, Any]]:
    """
    Replace _mlb_id with player_id in stats for newly-created stub players.

    Removes any stats that still cannot be resolved to a player_id.
    """
    resolved = []
    for row in stats:
        if "_mlb_id" in row:
            mlb_id = row.pop("_mlb_id")
            player_id = mlb_id_to_player_id.get(mlb_id)
            if player_id:
                row["player_id"] = player_id
                resolved.append(row)
            else:
                logger.warning(f"Could not resolve player_id for mlb_id {mlb_id}")
        else:
            resolved.append(row)
    return resolved


def save_stats_to_json(
    hitter_stats: List[Dict[str, Any]],
    pitcher_stats: List[Dict[str, Any]],
    data_dir: Path,
):
    """Save stats to JSON fixture files."""
    data_dir.mkdir(parents=True, exist_ok=True)

    hitter_file = data_dir / "hitter_daily_stats.json"
    with open(hitter_file, "w") as f:
        json.dump(hitter_stats, f, indent=2, default=str)
    logger.info(f"Saved {len(hitter_stats)} hitter stat rows to {hitter_file}")

    pitcher_file = data_dir / "pitcher_daily_stats.json"
    with open(pitcher_file, "w") as f:
        json.dump(pitcher_stats, f, indent=2, default=str)
    logger.info(f"Saved {len(pitcher_stats)} pitcher stat rows to {pitcher_file}")


async def main():
    """Main execution function."""
    args = parse_args()
    dates = get_date_range(args)

    logger.info("=" * 60)
    logger.info("MLB Boxscore Fetch")
    logger.info("=" * 60)
    logger.info(f"Dates: {dates[0]} to {dates[-1]} ({len(dates)} day(s))")
    logger.info(f"Season: {args.season}")
    logger.info(f"Output directory: {DATA_DIR}")
    logger.info("=" * 60)

    # Step 1: Build player lookup from database
    logger.info("Step 1: Building MLB ID → player ID lookup...")
    db = SessionLocal()
    try:
        mlb_id_lookup = build_mlb_id_lookup(db)

        if not mlb_id_lookup:
            logger.error("No players with MLB IDs found in database")
            sys.exit(1)

        # Step 2: Fetch boxscores for each date
        logger.info("Step 2: Fetching boxscores from MLB Stats API...")
        all_hitter_stats: List[Dict[str, Any]] = []
        all_pitcher_stats: List[Dict[str, Any]] = []
        total_stubs = 0

        for date_str in dates:
            logger.info(f"Processing {date_str}...")

            hitter_stats, pitcher_stats, unknown_info = await fetch_daily_boxscores(
                date_str, mlb_id_lookup
            )

            # Handle unknown players (create stubs in DB)
            if unknown_info:
                logger.info(
                    f"  Found {len(unknown_info)} unknown MLB players, "
                    "creating stubs..."
                )
                new_ids = create_stub_players(unknown_info, db)
                total_stubs += len(new_ids)

                # Resolve _mlb_id → player_id in stats
                hitter_stats = resolve_unknown_stats(hitter_stats, new_ids)
                pitcher_stats = resolve_unknown_stats(pitcher_stats, new_ids)

                # Update lookup for subsequent dates in backfill
                for mlb_id, player_id in new_ids.items():
                    pos = unknown_info[mlb_id]["position"]
                    key = "pitcher" if is_pitcher_position(pos) else "hitter"
                    mlb_id_lookup[mlb_id] = {key: player_id}

            all_hitter_stats.extend(hitter_stats)
            all_pitcher_stats.extend(pitcher_stats)

        # Step 3: Aggregate doubleheader stats
        logger.info("Step 3: Aggregating doubleheader stats...")
        all_hitter_stats = aggregate_stats_by_player_date(
            all_hitter_stats, derive_singles=True
        )
        all_pitcher_stats = aggregate_stats_by_player_date(
            all_pitcher_stats, derive_singles=False
        )

        # Step 4: Save to JSON
        logger.info("Step 4: Saving stats to JSON fixtures...")
        save_stats_to_json(all_hitter_stats, all_pitcher_stats, DATA_DIR)

        # Summary
        logger.info("=" * 60)
        logger.info("Summary:")
        logger.info(f"  Dates processed: {len(dates)}")
        logger.info(f"  Hitter stat rows: {len(all_hitter_stats)}")
        logger.info(f"  Pitcher stat rows: {len(all_pitcher_stats)}")
        logger.info(
            f"  Total stat rows: "
            f"{len(all_hitter_stats) + len(all_pitcher_stats)}"
        )
        logger.info(f"  Stub players created: {total_stubs}")
        logger.info("=" * 60)
        logger.info("✓ Fetch complete!")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
