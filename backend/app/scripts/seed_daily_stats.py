"""
Seed daily stats from JSON fixtures into the database.

Usage:
    python -m app.scripts.seed_daily_stats [--dir data/mlb-stats/]

This script:
1. Reads hitter_daily_stats.json and pitcher_daily_stats.json
2. Converts date strings to date objects
3. Upserts into database (updates on conflict)
4. Uses batch commits for performance

Designed to be idempotent - can be run multiple times safely.
"""

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.models import HitterDailyStats, PitcherDailyStats

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Batch size for commits
BATCH_SIZE = 500


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Seed daily stats from JSON fixtures into database"
    )
    parser.add_argument(
        "--dir",
        type=str,
        default="data/mlb-stats/",
        help="Directory containing JSON fixture files (default: data/mlb-stats/)",
    )
    return parser.parse_args()


def load_json_fixture(file_path: Path) -> list[dict]:
    """
    Load JSON fixture file.

    Args:
        file_path: Path to JSON file

    Returns:
        List of stat dicts
    """
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return []

    with open(file_path, "r") as f:
        data = json.load(f)

    logger.info(f"Loaded {len(data)} rows from {file_path}")
    return data


def convert_date_strings(stats: list[dict]) -> list[dict]:
    """
    Convert date strings to date objects.

    Args:
        stats: List of stat dicts with 'date' as string (YYYY-MM-DD)

    Returns:
        List of stat dicts with 'date' as date object
    """
    for stat in stats:
        if "date" in stat and isinstance(stat["date"], str):
            stat["date"] = datetime.strptime(stat["date"], "%Y-%m-%d").date()
    return stats


def seed_hitter_stats(stats: list[dict]):
    """
    Seed hitter daily stats into database.

    Uses upsert (INSERT ... ON CONFLICT DO UPDATE) for idempotency.

    Args:
        stats: List of hitter stat dicts
    """
    if not stats:
        logger.info("No hitter stats to seed")
        return

    db = SessionLocal()
    try:
        total = len(stats)
        for i in range(0, total, BATCH_SIZE):
            batch = stats[i : i + BATCH_SIZE]

            # Use PostgreSQL INSERT ... ON CONFLICT DO UPDATE
            stmt = insert(HitterDailyStats).values(batch)
            update_dict = {
                c.name: c for c in stmt.excluded if c.name not in ("player_id", "date")
            }
            stmt = stmt.on_conflict_do_update(
                index_elements=["player_id", "date"], set_=update_dict
            )

            db.execute(stmt)
            db.commit()

            logger.info(f"Seeded hitter stats batch {i//BATCH_SIZE + 1} ({i+len(batch)}/{total})")

        logger.info(f"✓ Seeded {total} hitter stat rows")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding hitter stats: {e}")
        raise
    finally:
        db.close()


def seed_pitcher_stats(stats: list[dict]):
    """
    Seed pitcher daily stats into database.

    Uses upsert (INSERT ... ON CONFLICT DO UPDATE) for idempotency.

    Args:
        stats: List of pitcher stat dicts
    """
    if not stats:
        logger.info("No pitcher stats to seed")
        return

    db = SessionLocal()
    try:
        total = len(stats)
        for i in range(0, total, BATCH_SIZE):
            batch = stats[i : i + BATCH_SIZE]

            # Use PostgreSQL INSERT ... ON CONFLICT DO UPDATE
            stmt = insert(PitcherDailyStats).values(batch)
            update_dict = {
                c.name: c for c in stmt.excluded if c.name not in ("player_id", "date")
            }
            stmt = stmt.on_conflict_do_update(
                index_elements=["player_id", "date"], set_=update_dict
            )

            db.execute(stmt)
            db.commit()

            logger.info(f"Seeded pitcher stats batch {i//BATCH_SIZE + 1} ({i+len(batch)}/{total})")

        logger.info(f"✓ Seeded {total} pitcher stat rows")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding pitcher stats: {e}")
        raise
    finally:
        db.close()


def main():
    """Main execution function."""
    args = parse_args()

    # Resolve directory path
    data_dir = Path(args.dir)
    if not data_dir.is_absolute():
        # Relative to project root (backend/app/scripts → backend → project root)
        project_root = Path(__file__).parent.parent.parent.parent
        data_dir = project_root / data_dir

    logger.info("=" * 60)
    logger.info("Daily Stats Database Seeding")
    logger.info("=" * 60)
    logger.info(f"Source directory: {data_dir}")
    logger.info("=" * 60)

    # Load fixtures
    logger.info("Step 1: Loading JSON fixtures...")
    hitter_stats = load_json_fixture(data_dir / "hitter_daily_stats.json")
    pitcher_stats = load_json_fixture(data_dir / "pitcher_daily_stats.json")

    if not hitter_stats and not pitcher_stats:
        logger.error("No fixture files found. Run fetch_mlb_daily_stats.py first.")
        return

    # Convert date strings
    logger.info("Step 2: Converting date strings...")
    hitter_stats = convert_date_strings(hitter_stats)
    pitcher_stats = convert_date_strings(pitcher_stats)

    # Seed database
    logger.info("Step 3: Seeding database...")
    seed_hitter_stats(hitter_stats)
    seed_pitcher_stats(pitcher_stats)

    # Summary
    logger.info("=" * 60)
    logger.info("Summary:")
    logger.info(f"  Hitter stats seeded: {len(hitter_stats)}")
    logger.info(f"  Pitcher stats seeded: {len(pitcher_stats)}")
    logger.info(f"  Total rows seeded: {len(hitter_stats) + len(pitcher_stats)}")
    logger.info("=" * 60)
    logger.info("✓ Seeding complete!")


if __name__ == "__main__":
    main()
