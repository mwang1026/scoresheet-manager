"""Service for importing PECOTA projection data."""

from datetime import datetime
from typing import Any

from app.config import settings


def parse_int(value: str) -> int | None:
    """Parse integer, return None if empty or invalid."""
    if not value or value.strip() == "":
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_float(value: str) -> float | None:
    """Parse float, return None if empty or invalid."""
    if not value or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_date(date_str: str) -> datetime.date | None:
    """Parse PECOTA date string to date object."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def ip_to_outs(ip_str: str) -> int:
    """
    Convert IP (innings pitched) string to outs.

    Example: "192.3" means 192 innings + 1 out = 192*3 + 1 = 577 outs
    """
    if not ip_str or ip_str.strip() == "":
        return 0
    try:
        ip = float(ip_str)
        return round(ip * 3)
    except ValueError:
        return 0


def parse_pecota_player_data(row: dict[str, str], primary_position: str = None) -> dict[str, Any]:
    """
    Parse player metadata from PECOTA row.

    Args:
        row: Dictionary from csv.DictReader with PECOTA column names
        primary_position: Override for primary_position (e.g., 'P' for pitchers)

    Returns:
        Dictionary with player fields for enrichment
    """
    position = primary_position or row.get("pos", "")[:5]

    return {
        "mlb_id": parse_int(row["mlbid"]),
        "bp_id": parse_int(row["bpid"]),
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "primary_position": position,
        "bats": row["bats"] if row.get("bats") else None,
        "throws": row["throws"] if row.get("throws") else None,
        "birthday": parse_date(row.get("birthday", "")),
        "height": parse_int(row.get("height")),
        "weight": parse_int(row.get("weight")),
        "age": parse_int(row.get("age")),
        "current_mlb_team": row["team"][:5] if row.get("team") else None,
        "is_trade_bait": False,
    }


def parse_hitter_projection(row: dict[str, str], player_id: int) -> dict[str, Any]:
    """
    Parse PECOTA hitter projection data from TSV row.

    Args:
        row: Dictionary from csv.DictReader with PECOTA column names
        player_id: Database ID of the player

    Returns:
        Dictionary ready for HitterProjection model
    """
    return {
        "player_id": player_id,
        "source": "PECOTA-50",
        "season": parse_int(row["season"]) or settings.SEED_LEAGUE_SEASON,
        # Counting stats
        "pa": parse_int(row["pa"]) or 0,
        "g": parse_int(row["g"]) or 0,
        "ab": parse_int(row["ab"]) or 0,
        "r": parse_int(row["r"]) or 0,
        "b1": parse_int(row["b1"]) or 0,
        "b2": parse_int(row["b2"]) or 0,
        "b3": parse_int(row["b3"]) or 0,
        "hr": parse_int(row["hr"]) or 0,
        "h": parse_int(row["h"]) or 0,
        "tb": parse_int(row["tb"]) or 0,
        "rbi": parse_int(row["rbi"]) or 0,
        "bb": parse_int(row["bb"]) or 0,
        "hbp": parse_int(row["hbp"]) or 0,
        "so": parse_int(row["so"]) or 0,
        "sb": parse_int(row["sb"]) or 0,
        "cs": parse_int(row["cs"]) or 0,
        # Rate stats
        "avg": parse_float(row["avg"]),
        "obp": parse_float(row["obp"]),
        "slg": parse_float(row["slg"]),
        "babip": parse_float(row["babip"]),
        # Advanced metrics
        "drc_plus": parse_int(row["drc_plus"]),
        "drb": parse_float(row["drb"]),
        "drp": parse_float(row["drp"]),
        "vorp": parse_float(row["vorp"]),
        "warp": parse_float(row["warp"]),
        # Metadata
        "dc_fl": row.get("dc_fl", "").upper() == "TRUE",
        "drp_str": row.get("drp_str") if row.get("drp_str") else None,
        "comparables": row.get("comparables") if row.get("comparables") else None,
    }


def parse_pitcher_projection(row: dict[str, str], player_id: int) -> dict[str, Any]:
    """
    Parse PECOTA pitcher projection data from TSV row.

    Args:
        row: Dictionary from csv.DictReader with PECOTA column names
        player_id: Database ID of the player

    Returns:
        Dictionary ready for PitcherProjection model
    """
    return {
        "player_id": player_id,
        "source": "PECOTA-50",
        "season": parse_int(row["season"]) or settings.SEED_LEAGUE_SEASON,
        # Counting stats
        "w": parse_int(row["w"]) or 0,
        "l": parse_int(row["l"]) or 0,
        "sv": parse_int(row["sv"]) or 0,
        "hld": parse_int(row["hld"]) or 0,
        "g": parse_int(row["g"]) or 0,
        "gs": parse_int(row["gs"]) or 0,
        "qs": parse_int(row["qs"]) or 0,
        "bf": parse_int(row["bf"]) or 0,
        "ip_outs": ip_to_outs(row["ip"]),
        "h": parse_int(row["h"]) or 0,
        "hr": parse_int(row["hr"]) or 0,
        "bb": parse_int(row["bb"]) or 0,
        "hbp": parse_int(row["hbp"]) or 0,
        "so": parse_int(row["so"]) or 0,
        # Rate stats
        "era": parse_float(row["era"]),
        "whip": parse_float(row["whip"]),
        "babip": parse_float(row["babip"]),
        "bb9": parse_float(row["bb9"]),
        "so9": parse_float(row["so9"]),
        # Advanced metrics
        "fip": parse_float(row["fip"]),
        "cfip": parse_int(row["cfip"]),
        "dra": parse_float(row["dra"]),
        "dra_minus": parse_int(row["dra_minus"]),
        "warp": parse_float(row["warp"]),
        "gb_percent": parse_float(row["gb_percent"]),
        # Metadata
        "dc_fl": row.get("dc_fl", "").upper() == "TRUE",
        "comparables": row.get("comparables") if row.get("comparables") else None,
    }
