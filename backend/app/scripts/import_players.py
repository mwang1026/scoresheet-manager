"""Import players from Scoresheet TSV file."""

import csv
import logging
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.database import SessionLocal
from app.models import Player, PlayerPosition
from app.services.player_import import parse_defensive_positions, parse_scoresheet_player

logger = logging.getLogger(__name__)


def import_players(tsv_path: str) -> None:
    """Import players from Scoresheet TSV file."""
    db = SessionLocal()

    try:
        with open(tsv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")

            players_imported = 0
            positions_imported = 0
            mlb_ids_seen = {}  # Track mlb_id duplicates

            for row in reader:
                # Parse player data using service
                player_data = parse_scoresheet_player(row)
                scoresheet_id = player_data["scoresheet_id"]
                mlb_id = player_data["mlb_id"]

                # Warn about duplicate mlb_ids (legitimate for two-way players)
                if mlb_id and mlb_id in mlb_ids_seen:
                    prev_player = mlb_ids_seen[mlb_id]
                    logger.info(
                        "Duplicate mlb_id %s: %s and %s %s (scoresheet_id %s)",
                        mlb_id, prev_player,
                        player_data['first_name'], player_data['last_name'],
                        scoresheet_id,
                    )
                if mlb_id:
                    mlb_ids_seen[mlb_id] = (
                        f"{player_data['first_name']} {player_data['last_name']} "
                        f"(scoresheet_id {scoresheet_id})"
                    )

                # Upsert player (on scoresheet_id conflict, update)
                stmt = insert(Player).values(**player_data)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["scoresheet_id"],
                    set_={k: v for k, v in player_data.items() if k != "scoresheet_id"},
                )
                db.execute(stmt)
                db.commit()

                # Get player_id for position insertion
                player = db.execute(
                    select(Player).where(Player.scoresheet_id == scoresheet_id)
                ).scalar_one()

                players_imported += 1

                # Import defensive positions using service
                positions = parse_defensive_positions(row)
                for pos_data in positions:
                    position_data = {"player_id": player.id, **pos_data}

                    # Upsert position
                    pos_stmt = insert(PlayerPosition).values(**position_data)
                    pos_stmt = pos_stmt.on_conflict_do_update(
                        index_elements=["player_id", "position"],
                        set_={"rating": position_data["rating"]},
                    )
                    db.execute(pos_stmt)
                    db.commit()
                    positions_imported += 1

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
