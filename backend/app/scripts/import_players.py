"""Import players from Scoresheet TSV file."""

import csv
import logging
import sys
from pathlib import Path

from app.database import SessionLocal
from app.services.player_import import upsert_player_and_positions

logger = logging.getLogger(__name__)


def import_players(tsv_path: str) -> None:
    """Import players from Scoresheet TSV file."""
    db = SessionLocal()

    try:
        with open(tsv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")

            players_imported = 0
            positions_imported = 0
            mlb_ids_seen: dict[int, str] = {}

            for row in reader:
                result = upsert_player_and_positions(db, row)

                # Warn about duplicate mlb_ids (legitimate for two-way players)
                if result.mlb_id and result.mlb_id in mlb_ids_seen:
                    prev_player = mlb_ids_seen[result.mlb_id]
                    logger.info(
                        "Duplicate mlb_id %s: %s and %s %s (scoresheet_id %s)",
                        result.mlb_id,
                        prev_player,
                        result.first_name,
                        result.last_name,
                        result.scoresheet_id,
                    )
                if result.mlb_id:
                    mlb_ids_seen[result.mlb_id] = (
                        f"{result.first_name} {result.last_name} "
                        f"(scoresheet_id {result.scoresheet_id})"
                    )

                db.commit()
                players_imported += 1
                positions_imported += result.positions_count

                if players_imported % 100 == 0:
                    logger.info("Imported %d players...", players_imported)

        logger.info("Import complete:")
        logger.info("  Players: %d", players_imported)
        logger.info("  Positions: %d", positions_imported)

    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        logger.error("Usage: python -m app.scripts.import_players <path_to_tsv>")
        sys.exit(1)

    tsv_path = sys.argv[1]
    if not Path(tsv_path).exists():
        logger.error("File not found: %s", tsv_path)
        sys.exit(1)

    import_players(tsv_path)
