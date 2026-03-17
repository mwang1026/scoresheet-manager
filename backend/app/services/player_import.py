"""Service for importing Scoresheet player data."""

import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.constants import is_pitcher_position
from app.models import Player, PlayerPosition

_DRAFT_SUFFIX_RE = re.compile(r"\s*\(round/\d+[A-Za-z]?/\d{4}/MLB/draft\)")


def strip_draft_suffix(name: str) -> str:
    """Strip the Scoresheet draft-round suffix from a player name."""
    return _DRAFT_SUFFIX_RE.sub("", name)


# Columns that parse_scoresheet_player depends on
REQUIRED_TSV_COLUMNS: frozenset[str] = frozenset(
    {"SSBB", "MLBAM", "NL", "pos", "h", "age", "team", "firstName", "lastName"}
)


def validate_tsv_columns(fieldnames: list[str] | None) -> None:
    """Raise ValueError if required TSV columns are missing."""
    if fieldnames is None:
        raise ValueError("TSV has no header row")
    missing = REQUIRED_TSV_COLUMNS - set(fieldnames)
    if missing:
        raise ValueError(f"TSV missing required columns: {sorted(missing)}")


@dataclass
class UpsertResult:
    """Summary of a single player upsert."""

    scoresheet_id: int | None
    mlb_id: int | None
    first_name: str
    last_name: str
    positions_count: int


def upsert_player_and_positions(session: Session, row: dict[str, str]) -> UpsertResult:
    """Parse a TSV row and upsert the Player + PlayerPositions.

    Does NOT commit — the caller controls the transaction boundary.
    """
    player_data = parse_scoresheet_player(row)
    scoresheet_id = player_data["scoresheet_id"]

    # Upsert player (on scoresheet_id conflict, update)
    stmt = insert(Player).values(**player_data)
    stmt = stmt.on_conflict_do_update(
        index_elements=["scoresheet_id"],
        set_={k: v for k, v in player_data.items() if k != "scoresheet_id"},
    )
    session.execute(stmt)
    session.flush()

    # Get player_id for position insertion
    player = session.execute(
        select(Player).where(Player.scoresheet_id == scoresheet_id)
    ).scalar_one()

    # Upsert defensive positions
    positions = parse_defensive_positions(row)
    for pos_data in positions:
        position_data = {"player_id": player.id, **pos_data}
        pos_stmt = insert(PlayerPosition).values(**position_data)
        pos_stmt = pos_stmt.on_conflict_do_update(
            index_elements=["player_id", "position"],
            set_={"rating": position_data["rating"]},
        )
        session.execute(pos_stmt)

    return UpsertResult(
        scoresheet_id=scoresheet_id,
        mlb_id=player_data["mlb_id"],
        first_name=player_data["first_name"],
        last_name=player_data["last_name"],
        positions_count=len(positions),
    )


def parse_scoresheet_player(row: dict[str, str]) -> dict[str, Any]:
    """
    Parse a single row from Scoresheet TSV into player data.

    Args:
        row: Dictionary from csv.DictReader with Scoresheet column names

    Returns:
        Dictionary with player fields ready for database insertion
    """
    player_data = {
        "scoresheet_id": int(row["SSBB"]) if row["SSBB"] else None,
        "mlb_id": int(row["MLBAM"]) if row["MLBAM"] else None,
        "scoresheet_nl_id": int(row["NL"]) if row["NL"] else None,
        "primary_position": row["pos"],
        "bats": row["h"] if row["h"] else None,
        "age": int(row["age"]) if row["age"] else None,
        "current_mlb_team": row["team"] if row["team"] else None,
        "first_name": row["firstName"],
        "last_name": row["lastName"],
        "is_trade_bait": False,
    }

    # Add catcher steal rates (if present)
    if row.get("osbAL"):
        player_data["osb_al"] = float(row["osbAL"])
    if row.get("ocsAL"):
        player_data["ocs_al"] = float(row["ocsAL"])
    if row.get("osbNL"):
        player_data["osb_nl"] = float(row["osbNL"])
    if row.get("ocsNL"):
        player_data["ocs_nl"] = float(row["ocsNL"])

    # Add batting split adjustments (if present and not a pitcher)
    if not is_pitcher_position(row["pos"]):
        if row.get("BAvR"):
            player_data["ba_vr"] = int(row["BAvR"])
        if row.get("OBvR"):
            player_data["ob_vr"] = int(row["OBvR"])
        if row.get("SLvR"):
            player_data["sl_vr"] = int(row["SLvR"])
        if row.get("BAvL"):
            player_data["ba_vl"] = int(row["BAvL"])
        if row.get("OBvL"):
            player_data["ob_vl"] = int(row["OBvL"])
        if row.get("SLvL"):
            player_data["sl_vl"] = int(row["SLvL"])

    return player_data


def parse_defensive_positions(row: dict[str, str]) -> list[dict[str, Any]]:
    """
    Parse defensive position ratings from Scoresheet TSV row.

    Args:
        row: Dictionary from csv.DictReader with Scoresheet column names

    Returns:
        List of position dictionaries with 'position' and 'rating' keys
    """
    positions = []

    for position_col in ["1B", "2B", "3B", "SS", "OF"]:
        rating_str = row.get(position_col) or ""
        rating_str = rating_str.strip()
        if rating_str:
            try:
                rating = float(rating_str)
                positions.append({"position": position_col, "rating": rating})
            except ValueError:
                # Invalid rating, skip
                pass

    return positions
