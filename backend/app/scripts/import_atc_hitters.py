"""Import ATC hitter projections from enriched TSV file.

Reads a TSV file with an mlb_id column (output of prepare_atc_hitters.py)
and upserts HitterProjection records with source="ATC".

Unlike PECOTA import, this does NOT create new Player records —
only maps to existing players. Unmatched rows are logged and skipped.

Usage:
    cd backend
    python -m app.scripts.import_atc_hitters "../data/ATC 2026 - Hitting.tsv"
"""

import csv
import logging
import sys
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import HitterProjection, Player
from app.services.projection_import import (
    batch_upsert_projections,
    parse_atc_hitter_projection,
    parse_int,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def import_atc_hitters(tsv_path: str) -> None:
    """Import ATC hitter projections from enriched TSV file."""
    db = SessionLocal()

    try:
        with open(tsv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")

            projection_batch: list[dict] = []
            skipped_no_mlbid = 0
            skipped_no_player = 0

            for row in reader:
                mlb_id = parse_int(row.get("mlb_id", ""))
                if not mlb_id:
                    skipped_no_mlbid += 1
                    logger.debug("Skipping row with no mlb_id: %s", row.get("Name", "Unknown"))
                    continue

                # Find player — prefer non-pitcher for hitter projections (two-way players)
                players = db.execute(
                    select(Player)
                    .where(Player.mlb_id == mlb_id)
                    .order_by(
                        (Player.primary_position != "P").desc(),
                        (Player.primary_position != "SR").desc(),
                    )
                ).scalars().all()

                player = players[0] if players else None

                if not player:
                    skipped_no_player += 1
                    logger.warning(
                        "No player found for mlb_id=%d (%s), skipping",
                        mlb_id, row.get("Name", "Unknown"),
                    )
                    continue

                projection_batch.append(parse_atc_hitter_projection(row, player.id))

        projections_imported = batch_upsert_projections(db, HitterProjection, projection_batch)
        logger.info("Import complete:")
        logger.info("  Projections imported: %d", projections_imported)
        logger.info("  Skipped (no mlb_id): %d", skipped_no_mlbid)
        logger.info("  Skipped (no player): %d", skipped_no_player)

    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.import_atc_hitters <path_to_tsv>")
        sys.exit(1)

    tsv_path = sys.argv[1]
    if not Path(tsv_path).exists():
        logger.error("File not found: %s", tsv_path)
        sys.exit(1)

    import_atc_hitters(tsv_path)
