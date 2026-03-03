"""Import PECOTA pitcher projections from TSV file."""

import csv
import logging
import sys
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import PitcherProjection, Player
from app.services.projection_import import (
    batch_upsert_projections,
    enrich_player_from_pecota,
    parse_int,
    parse_pecota_player_data,
    parse_pitcher_projection,
)

logger = logging.getLogger(__name__)


def import_pecota_pitchers(tsv_path: str) -> None:
    """Import pitcher projections from PECOTA TSV file."""
    db = SessionLocal()

    try:
        with open(tsv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")

            projection_batch: list[dict] = []
            players_created = 0
            players_enriched = 0

            for row in reader:
                mlb_id = parse_int(row["mlbid"])
                if not mlb_id:
                    logger.warning("Skipping row with no mlbid: %s", row.get('name', 'Unknown'))
                    continue

                # Find or create player
                # For two-way players (same mlb_id, multiple entries), prefer pitcher for pitcher projections
                players = db.execute(
                    select(Player)
                    .where(Player.mlb_id == mlb_id)
                    .order_by((Player.primary_position == "P").desc(), (Player.primary_position == "SR").desc())
                ).scalars().all()

                player = players[0] if players else None

                if not player:
                    # Create minimal player record from PECOTA data
                    # For pitchers, primary_position is typically "P"
                    player_data = parse_pecota_player_data(row, primary_position="P")
                    player = Player(**player_data)
                    db.add(player)
                    db.commit()
                    db.refresh(player)
                    players_created += 1
                else:
                    # Enrich existing player with PECOTA data
                    if enrich_player_from_pecota(player, row):
                        db.commit()
                        players_enriched += 1

                # Accumulate projection for batch upsert
                projection_batch.append(parse_pitcher_projection(row, player.id))

        projections_imported = batch_upsert_projections(db, PitcherProjection, projection_batch)
        logger.info("Import complete:")
        logger.info("  Projections: %d", projections_imported)
        logger.info("  Players created: %d", players_created)
        logger.info("  Players enriched: %d", players_enriched)

    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        logger.error("Usage: python -m app.scripts.import_pecota_pitchers <path_to_tsv>")
        sys.exit(1)

    tsv_path = sys.argv[1]
    if not Path(tsv_path).exists():
        logger.error("File not found: %s", tsv_path)
        sys.exit(1)

    import_pecota_pitchers(tsv_path)
