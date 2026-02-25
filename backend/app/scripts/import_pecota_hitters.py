"""Import hitter projections from PECOTA TSV file."""

import csv
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.models import HitterProjection, Player
from app.services.projection_import import (
    enrich_player_from_pecota,
    parse_hitter_projection,
    parse_int,
    parse_pecota_player_data,
)


def import_pecota_hitters(tsv_path: str) -> None:
    """Import hitter projections from PECOTA TSV file."""
    db = SessionLocal()

    try:
        with open(tsv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")

            projections_imported = 0
            players_created = 0
            players_enriched = 0

            for row in reader:
                mlb_id = parse_int(row["mlbid"])
                if not mlb_id:
                    print(f"Warning: Skipping row with no mlbid: {row.get('name', 'Unknown')}")
                    continue

                # Find or create player
                # For two-way players (same mlb_id, multiple entries), prefer non-pitcher for hitter projections
                players = db.execute(
                    select(Player)
                    .where(Player.mlb_id == mlb_id)
                    .order_by((Player.primary_position != "P").desc(), (Player.primary_position != "SR").desc())
                ).scalars().all()

                player = players[0] if players else None

                if not player:
                    # Create minimal player record from PECOTA data
                    player_data = parse_pecota_player_data(row)
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

                # Create projection data
                projection_data = parse_hitter_projection(row, player.id)

                # Upsert projection
                stmt = insert(HitterProjection).values(**projection_data)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["player_id", "source"],
                    set_={
                        k: v
                        for k, v in projection_data.items()
                        if k not in ("player_id", "source")
                    },
                )
                db.execute(stmt)
                db.commit()
                projections_imported += 1

                if projections_imported % 100 == 0:
                    print(f"Imported {projections_imported} hitter projections...")

        print(f"\nImport complete:")
        print(f"  Projections: {projections_imported}")
        print(f"  Players created: {players_created}")
        print(f"  Players enriched: {players_enriched}")

    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.scripts.import_pecota_hitters <path_to_tsv>")
        sys.exit(1)

    tsv_path = sys.argv[1]
    if not Path(tsv_path).exists():
        print(f"Error: File not found: {tsv_path}")
        sys.exit(1)

    import_pecota_hitters(tsv_path)
