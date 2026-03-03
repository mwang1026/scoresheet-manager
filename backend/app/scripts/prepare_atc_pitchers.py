"""Match ATC pitcher names to mlb_ids and output enriched TSV.

Reads a raw ATC pitcher TSV (from FanGraphs/ATC projection export) and
matches each player to their mlb_id by looking up (first_name, last_name, team)
in the database. Outputs a new TSV with all original columns plus an mlb_id column.

For two-way players, prefers the pitcher entry (opposite of hitter prepare script).

Usage:
    cd backend
    python -m app.scripts.prepare_atc_pitchers \
        "../data/ATC 2026 - Pitching - raw.tsv" \
        "../data/ATC 2026 - Pitching.tsv"
"""

import csv
import logging
import sys
from pathlib import Path

from app.database import SessionLocal
from app.services.name_matching import (
    PLAYER_NAME_OVERRIDES,
    TEAM_ABBR_MAP,
    build_player_lookups,
    match_player,
    split_name,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def prepare_atc_pitchers(input_path: str, output_path: str) -> None:
    """Read raw ATC TSV, match names to mlb_ids, write enriched TSV."""
    db = SessionLocal()

    try:
        exact_lookup, name_lookup = build_player_lookups(db)
        logger.info("Loaded %d exact entries, %d name entries from DB",
                     len(exact_lookup), len(name_lookup))

        matched = 0
        unmatched = 0
        unmatched_names: list[str] = []

        with open(input_path, "r", encoding="utf-8") as fin, \
             open(output_path, "w", encoding="utf-8", newline="") as fout:

            reader = csv.DictReader(fin, delimiter="\t")
            fieldnames = list(reader.fieldnames or []) + ["mlb_id"]
            writer = csv.DictWriter(fout, fieldnames=fieldnames, delimiter="\t")
            writer.writeheader()

            for row in reader:
                name = row.get("Name", "")
                atc_team = row.get("Team", "")
                scoresheet_team = TEAM_ABBR_MAP.get(atc_team) if atc_team else None

                # Check manual overrides first (keyed by scoresheet team)
                override_db_name = PLAYER_NAME_OVERRIDES.get(
                    (name, scoresheet_team)
                ) if scoresheet_team else None

                if override_db_name:
                    first, last = split_name(override_db_name)
                    mlb_id = match_player(
                        first, last, scoresheet_team, exact_lookup, name_lookup,
                        prefer_pitcher=True,
                    )
                else:
                    first, last = split_name(name)
                    mlb_id = match_player(
                        first, last, scoresheet_team, exact_lookup, name_lookup,
                        prefer_pitcher=True,
                    )

                row["mlb_id"] = str(mlb_id) if mlb_id else ""

                writer.writerow(row)

                if mlb_id:
                    matched += 1
                else:
                    unmatched += 1
                    unmatched_names.append(f"{name} ({atc_team})")

        logger.info("Matched: %d, Unmatched: %d", matched, unmatched)
        if unmatched_names:
            logger.warning("Unmatched players:")
            for name in unmatched_names:
                logger.warning("  %s", name)

    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m app.scripts.prepare_atc_pitchers <input_tsv> <output_tsv>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not Path(input_path).exists():
        logger.error("File not found: %s", input_path)
        sys.exit(1)

    prepare_atc_pitchers(input_path, output_path)
