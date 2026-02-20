"""Service for importing Scoresheet player data."""

from typing import Any


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
    if row["pos"] not in ("P", "SR"):
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
