"""Fetch and import the Scoresheet player list TSV from HTTP.

Runnable via weekly cron or manually:
    python -m app.scripts.fetch_scoresheet_players
"""

import csv
import io
import logging
import sys

import httpx

from app.config import settings
from app.database import SessionLocal
from app.services.player_import import (
    upsert_player_and_positions,
    validate_tsv_columns,
)

logger = logging.getLogger(__name__)


def build_tsv_url() -> str:
    """Construct the full URL for the Scoresheet player list TSV."""
    path = settings.SCORESHEET_PLAYERS_TSV_PATH.format(season=settings.SEED_LEAGUE_SEASON)
    return f"{settings.SCORESHEET_BASE_URL}/{path}"


def fetch_tsv(url: str) -> str:
    """Download the TSV content from the given URL.

    Raises httpx.HTTPStatusError on 4xx/5xx responses.
    Raises httpx.RequestError on network/connection failures.
    """
    with httpx.Client(timeout=30.0) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.text


def import_from_tsv_text(tsv_text: str) -> tuple[int, int]:
    """Parse TSV text and upsert all players in a single atomic transaction.

    Returns (players_imported, positions_imported).
    Raises ValueError if TSV columns are invalid.
    Rolls back on any row-level error.
    """
    reader = csv.DictReader(io.StringIO(tsv_text), delimiter="\t")
    validate_tsv_columns(reader.fieldnames)

    db = SessionLocal()
    players_imported = 0
    positions_imported = 0

    try:
        for row in reader:
            result = upsert_player_and_positions(db, row)
            players_imported += 1
            positions_imported += result.positions_count

        db.commit()
        return players_imported, positions_imported
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    """Fetch the Scoresheet player list and import it."""
    logging.basicConfig(level=settings.LOG_LEVEL, format="%(levelname)s: %(message)s")

    url = build_tsv_url()
    logger.info("Fetching player list from %s", url)

    try:
        tsv_text = fetch_tsv(url)
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "HTTP %s fetching player list: %s", exc.response.status_code, exc
        )
        sys.exit(1)
    except httpx.RequestError as exc:
        logger.warning("Network error fetching player list: %s", exc)
        sys.exit(1)

    try:
        players, positions = import_from_tsv_text(tsv_text)
    except ValueError as exc:
        logger.error("Malformed TSV: %s", exc)
        sys.exit(1)

    logger.info("Import complete: %d players, %d positions", players, positions)


if __name__ == "__main__":
    main()
