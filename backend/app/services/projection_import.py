"""Service for importing projection data (PECOTA, ATC, TheBatX, OOPSY)."""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models.projection import HitterProjection, PitcherProjection
from app.services.name_matching import FANGRAPHS_TEAM_MAP  # noqa: F401 — re-export

logger = logging.getLogger(__name__)


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


def enrich_player_from_pecota(player, row: dict[str, str]) -> bool:
    """Fill bp_id, birthday, throws, height, weight from PECOTA if missing. Returns True if updated."""
    enriched = False
    if not player.bp_id and row.get("bpid"):
        player.bp_id = parse_int(row["bpid"])
        enriched = True
    if not player.birthday and row.get("birthday"):
        player.birthday = parse_date(row["birthday"])
        enriched = True
    if not player.throws and row.get("throws"):
        player.throws = row["throws"]
        enriched = True
    if not player.height and row.get("height"):
        player.height = parse_int(row["height"])
        enriched = True
    if not player.weight and row.get("weight"):
        player.weight = parse_int(row["weight"])
        enriched = True
    return enriched


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


def parse_atc_hitter_projection(
    row: dict[str, str], player_id: int, source: str = "ATC",
) -> dict[str, Any]:
    """
    Parse FanGraphs-format hitter projection data from TSV row.

    Works for any source using FanGraphs column layout (ATC, TheBatX, etc.).
    Columns use uppercase names (H, 2B, 3B, HR, etc.) and rate stats
    come as decimal strings (.290). Singles and TB are derived from components.

    Args:
        row: Dictionary from csv.DictReader with FanGraphs column names
        player_id: Database ID of the player
        source: Projection source name (default "ATC")

    Returns:
        Dictionary ready for HitterProjection model
    """
    h = parse_int(row.get("H")) or 0
    b2 = parse_int(row.get("2B")) or 0
    b3 = parse_int(row.get("3B")) or 0
    hr = parse_int(row.get("HR")) or 0
    b1 = h - b2 - b3 - hr
    tb = b1 + 2 * b2 + 3 * b3 + 4 * hr

    return {
        "player_id": player_id,
        "source": source,
        "season": settings.SEED_LEAGUE_SEASON,
        # Counting stats
        "pa": parse_int(row.get("PA")) or 0,
        "g": parse_int(row.get("G")) or 0,
        "ab": parse_int(row.get("AB")) or 0,
        "r": parse_int(row.get("R")) or 0,
        "b1": b1,
        "b2": b2,
        "b3": b3,
        "hr": hr,
        "h": h,
        "tb": tb,
        "rbi": parse_int(row.get("RBI")) or 0,
        "bb": parse_int(row.get("BB")) or 0,
        "hbp": parse_int(row.get("HBP")) or 0,
        "so": parse_int(row.get("SO")) or 0,
        "sb": parse_int(row.get("SB")) or 0,
        "cs": parse_int(row.get("CS")) or 0,
        # Rate stats (ATC provides as ".290" format — parse_float handles fine)
        "avg": parse_float(row.get("AVG")),
        "obp": parse_float(row.get("OBP")),
        "slg": parse_float(row.get("SLG")),
        "babip": parse_float(row.get("BABIP")),
        # PECOTA-specific fields — not available from ATC
        "drc_plus": None,
        "drb": None,
        "drp": None,
        "vorp": None,
        "warp": None,
        "dc_fl": False,
        "drp_str": None,
        "comparables": None,
    }


def parse_atc_pitcher_projection(
    row: dict[str, str], player_id: int, source: str = "ATC",
) -> dict[str, Any]:
    """
    Parse FanGraphs-format pitcher projection data from TSV row.

    Works for any source using FanGraphs column layout (ATC, TheBatX, etc.).
    Columns use uppercase names (W, L, SV, etc.) and rate stats
    come as decimal strings (3.50). Fields not provided (bf, hbp)
    default to 0; PECOTA-specific advanced metrics are None.

    Args:
        row: Dictionary from csv.DictReader with FanGraphs column names
        player_id: Database ID of the player
        source: Projection source name (default "ATC")

    Returns:
        Dictionary ready for PitcherProjection model
    """
    return {
        "player_id": player_id,
        "source": source,
        "season": settings.SEED_LEAGUE_SEASON,
        # Counting stats
        "w": parse_int(row.get("W")) or 0,
        "l": parse_int(row.get("L")) or 0,
        "sv": parse_int(row.get("SV")) or 0,
        "hld": parse_int(row.get("HLD")) or 0,
        "g": parse_int(row.get("G")) or 0,
        "gs": parse_int(row.get("GS")) or 0,
        "qs": parse_int(row.get("QS")) or 0,
        "bf": 0,  # Not provided by ATC
        "ip_outs": ip_to_outs(row.get("IP", "")),
        "h": parse_int(row.get("H")) or 0,
        "hr": parse_int(row.get("HR")) or 0,
        "bb": parse_int(row.get("BB")) or 0,
        "hbp": 0,  # Not provided by ATC
        "so": parse_int(row.get("SO")) or 0,
        # Rate stats
        "era": parse_float(row.get("ERA")),
        "whip": parse_float(row.get("WHIP")),
        "babip": parse_float(row.get("BABIP")),
        "bb9": parse_float(row.get("BB/9")),
        "so9": parse_float(row.get("K/9")),
        # Advanced (ATC provides FIP)
        "fip": parse_float(row.get("FIP")),
        # PECOTA-specific — not available from ATC
        "cfip": None,
        "dra": None,
        "dra_minus": None,
        "warp": None,
        "gb_percent": None,
        "dc_fl": False,
        "comparables": None,
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


def batch_upsert_projections(
    db: Session,
    model: type[HitterProjection] | type[PitcherProjection],
    projections: list[dict[str, Any]],
) -> int:
    """Batch upsert projection rows in a single INSERT...ON CONFLICT DO UPDATE.

    Args:
        db: SQLAlchemy session
        model: HitterProjection or PitcherProjection class
        projections: List of projection dicts (each with player_id, source, etc.)

    Returns:
        Number of rows upserted
    """
    if not projections:
        return 0

    stmt = insert(model).values(projections)
    update_cols = {
        col: stmt.excluded[col]
        for col in projections[0]
        if col not in ("player_id", "source")
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["player_id", "source"],
        set_=update_cols,
    )
    db.execute(stmt)
    db.commit()
    count = len(projections)
    logger.info("Batch upserted %d %s projections", count, model.__tablename__)
    return count
