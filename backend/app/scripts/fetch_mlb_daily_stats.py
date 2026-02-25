"""
Fetch MLB daily stats from MLB Stats API and save as JSON fixtures.

Usage:
    python -m app.scripts.fetch_mlb_daily_stats [--start 09/01/2025] [--end 09/28/2025]

This script:
1. Queries all Scoresheet players from the database
2. Fetches game logs from MLB Stats API
3. Saves results to data/mlb-stats/hitter_daily_stats.json and pitcher_daily_stats.json

Designed for both one-time backfills and scheduled cron jobs.
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Player
from app.services.mlb_stats_api import fetch_all_player_stats

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
        description="Fetch MLB daily stats and save as JSON fixtures"
    )
    parser.add_argument(
        "--start",
        type=str,
        default="09/01/2025",
        help="Start date in MM/DD/YYYY format (default: 09/01/2025)",
    )
    parser.add_argument(
        "--end",
        type=str,
        default="09/28/2025",
        help="End date in MM/DD/YYYY format (default: 09/28/2025)",
    )
    parser.add_argument(
        "--season",
        type=int,
        default=2025,
        help="MLB season year (default: 2025)",
    )
    return parser.parse_args()


def get_scoresheet_players() -> list[dict]:
    """
    Query all Scoresheet players with MLB IDs from database.

    Returns:
        List of player dicts with id, mlb_id, position
    """
    db = SessionLocal()
    try:
        # Only Scoresheet league players with MLB IDs
        stmt = select(Player).where(
            Player.scoresheet_only(), Player.mlb_id.isnot(None)
        )
        players = db.execute(stmt).scalars().all()

        logger.info(f"Found {len(players)} Scoresheet players with MLB IDs")

        return [
            {
                "id": player.id,
                "mlb_id": player.mlb_id,
                "position": player.primary_position,
                "name": f"{player.first_name} {player.last_name}",
            }
            for player in players
        ]
    finally:
        db.close()


def save_stats_to_json(
    hitter_stats: list[dict], pitcher_stats: list[dict], data_dir: Path
):
    """
    Save stats to JSON fixture files.

    Args:
        hitter_stats: List of hitter stat dicts
        pitcher_stats: List of pitcher stat dicts
        data_dir: Output directory path
    """
    # Create directory if it doesn't exist
    data_dir.mkdir(parents=True, exist_ok=True)

    # Save hitter stats
    hitter_file = data_dir / "hitter_daily_stats.json"
    with open(hitter_file, "w") as f:
        json.dump(hitter_stats, f, indent=2, default=str)
    logger.info(f"Saved {len(hitter_stats)} hitter stat rows to {hitter_file}")

    # Save pitcher stats
    pitcher_file = data_dir / "pitcher_daily_stats.json"
    with open(pitcher_file, "w") as f:
        json.dump(pitcher_stats, f, indent=2, default=str)
    logger.info(f"Saved {len(pitcher_stats)} pitcher stat rows to {pitcher_file}")


async def main():
    """Main execution function."""
    args = parse_args()

    logger.info("=" * 60)
    logger.info("MLB Daily Stats Fetch")
    logger.info("=" * 60)
    logger.info(f"Date range: {args.start} - {args.end}")
    logger.info(f"Season: {args.season}")
    logger.info(f"Output directory: {DATA_DIR}")
    logger.info("=" * 60)

    # Step 1: Get players from database
    logger.info("Step 1: Querying Scoresheet players from database...")
    players = get_scoresheet_players()

    if not players:
        logger.error("No Scoresheet players found in database")
        sys.exit(1)

    # Step 2: Fetch stats from MLB API
    logger.info("Step 2: Fetching game logs from MLB Stats API...")
    logger.info(f"This will take approximately {len(players) * 0.075 / 60:.1f} minutes")

    hitter_stats, pitcher_stats = await fetch_all_player_stats(
        players, args.start, args.end, args.season
    )

    # Step 3: Save to JSON files
    logger.info("Step 3: Saving stats to JSON fixtures...")
    save_stats_to_json(hitter_stats, pitcher_stats, DATA_DIR)

    # Summary
    logger.info("=" * 60)
    logger.info("Summary:")
    logger.info(f"  Players queried: {len(players)}")
    logger.info(f"  Hitter stat rows: {len(hitter_stats)}")
    logger.info(f"  Pitcher stat rows: {len(pitcher_stats)}")
    logger.info(f"  Total stat rows: {len(hitter_stats) + len(pitcher_stats)}")
    logger.info("=" * 60)
    logger.info("✓ Fetch complete!")


if __name__ == "__main__":
    asyncio.run(main())
