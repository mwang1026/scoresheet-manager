"""
Generate frontend fixture files from database.

Usage:
    python -m app.scripts.generate_frontend_fixtures [--limit 20]

This script:
1. Queries DB for representative players with September 2025 stats
2. Generates players.json with proper field mapping
3. Generates hitter-stats.json and pitcher-stats.json with uppercase field names

Output files go to frontend/lib/fixtures/
"""

import argparse
import json
import logging
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import HitterDailyStats, PitcherDailyStats, Player, PlayerPosition, PlayerRoster

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Output directory (frontend/lib/fixtures/)
FRONTEND_FIXTURES_DIR = (
    Path(__file__).parent.parent.parent.parent / "frontend" / "lib" / "fixtures"
)


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate frontend fixture files from database"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Number of players to include (default: 20)",
    )
    return parser.parse_args()


def get_representative_players(limit: int = 20) -> list[dict]:
    """
    Query DB for representative players with September 2025 stats.

    Selects a diverse mix of:
    - Different positions
    - Different teams
    - Players with actual September stats
    - Include at least one two-way player if available

    Args:
        limit: Number of players to select

    Returns:
        List of player dicts with all fields for frontend
    """
    db = SessionLocal()
    try:
        # Find players with September stats
        # For hitters
        hitter_subq = (
            select(HitterDailyStats.player_id)
            .where(
                HitterDailyStats.date >= date(2025, 9, 1),
                HitterDailyStats.date <= date(2025, 9, 30),
            )
            .group_by(HitterDailyStats.player_id)
            .subquery()
        )

        # For pitchers
        pitcher_subq = (
            select(PitcherDailyStats.player_id)
            .where(
                PitcherDailyStats.date >= date(2025, 9, 1),
                PitcherDailyStats.date <= date(2025, 9, 30),
            )
            .group_by(PitcherDailyStats.player_id)
            .subquery()
        )

        # Get diverse mix of players
        # ~65% hitters, ~35% pitchers (13 hitters, 7 pitchers for limit=20)
        hitter_limit = int(limit * 0.65)
        pitcher_limit = limit - hitter_limit

        # Get hitters with stats
        hitters_stmt = (
            select(Player)
            .where(
                Player.id.in_(select(hitter_subq)),
                Player.scoresheet_id.isnot(None),
            )
            .order_by(func.random())
            .limit(hitter_limit)
        )
        hitters = db.execute(hitters_stmt).scalars().all()

        # Get pitchers with stats
        pitchers_stmt = (
            select(Player)
            .where(
                Player.id.in_(select(pitcher_subq)),
                Player.scoresheet_id.isnot(None),
            )
            .order_by(func.random())
            .limit(pitcher_limit)
        )
        pitchers = db.execute(pitchers_stmt).scalars().all()

        all_players = list(hitters) + list(pitchers)

        logger.info(
            f"Selected {len(hitters)} hitters and {len(pitchers)} pitchers "
            f"with September stats"
        )

        # Map to frontend format with sequential IDs
        frontend_players = []
        for idx, player in enumerate(all_players, start=1):
            # Get player positions
            positions_stmt = select(PlayerPosition).where(
                PlayerPosition.player_id == player.id
            )
            positions = db.execute(positions_stmt).scalars().all()

            position_map = {}
            for pos in positions:
                # Map position names to eligible_X fields (convert Decimal to float)
                rating = float(pos.rating) if pos.rating is not None else None
                if pos.position == "1B":
                    position_map["eligible_1b"] = rating
                elif pos.position == "2B":
                    position_map["eligible_2b"] = rating
                elif pos.position == "3B":
                    position_map["eligible_3b"] = rating
                elif pos.position == "SS":
                    position_map["eligible_ss"] = rating
                elif pos.position == "OF":
                    position_map["eligible_of"] = rating

            # Get player roster (team_id)
            roster_stmt = select(PlayerRoster).where(
                PlayerRoster.player_id == player.id,
                PlayerRoster.status == "rostered"
            ).limit(1)
            roster = db.execute(roster_stmt).scalars().first()
            team_id = roster.team_id if roster else None

            frontend_players.append(
                {
                    "id": idx,
                    "name": f"{player.first_name} {player.last_name}",
                    "mlb_id": player.mlb_id,
                    "scoresheet_id": player.scoresheet_id,
                    "primary_position": player.primary_position,
                    "hand": player.bats,
                    "age": player.age,
                    "current_team": player.current_mlb_team,
                    "team_id": team_id,
                    "eligible_1b": position_map.get("eligible_1b"),
                    "eligible_2b": position_map.get("eligible_2b"),
                    "eligible_3b": position_map.get("eligible_3b"),
                    "eligible_ss": position_map.get("eligible_ss"),
                    "eligible_of": position_map.get("eligible_of"),
                    "osb_al": float(player.osb_al) if player.osb_al else None,
                    "ocs_al": float(player.ocs_al) if player.ocs_al else None,
                    "ba_vr": player.ba_vr,
                    "ob_vr": player.ob_vr,
                    "sl_vr": player.sl_vr,
                    "ba_vl": player.ba_vl,
                    "ob_vl": player.ob_vl,
                    "sl_vl": player.sl_vl,
                    "_db_id": player.id,  # Keep original ID for stats lookup
                }
            )

        return frontend_players

    finally:
        db.close()


def get_hitter_stats(player_db_ids: list[int]) -> list[dict]:
    """
    Get September hitter stats for selected players.

    Args:
        player_db_ids: List of original database player IDs

    Returns:
        List of stat dicts with frontend field names (uppercase)
    """
    db = SessionLocal()
    try:
        stmt = select(HitterDailyStats).where(
            HitterDailyStats.player_id.in_(player_db_ids),
            HitterDailyStats.date >= date(2025, 9, 1),
            HitterDailyStats.date <= date(2025, 9, 30),
        )
        stats = db.execute(stmt).scalars().all()

        logger.info(f"Found {len(stats)} hitter stat rows")

        # Map to frontend format (lowercase → UPPERCASE)
        frontend_stats = []
        for stat in stats:
            frontend_stats.append(
                {
                    "player_id": stat.player_id,  # Will be remapped later
                    "date": stat.date.isoformat(),
                    "PA": stat.pa,
                    "AB": stat.ab,
                    "H": stat.h,
                    "1B": stat.single,
                    "2B": stat.double,
                    "3B": stat.triple,
                    "HR": stat.hr,
                    "SO": stat.so,
                    "GO": stat.go,
                    "FO": stat.fo,
                    "GDP": stat.gdp,
                    "BB": stat.bb,
                    "IBB": stat.ibb,
                    "HBP": stat.hbp,
                    "SB": stat.sb,
                    "CS": stat.cs,
                    "R": stat.r,
                    "RBI": stat.rbi,
                    "SF": stat.sf,
                    "SH": stat.sh,
                }
            )

        return frontend_stats

    finally:
        db.close()


def get_pitcher_stats(player_db_ids: list[int]) -> list[dict]:
    """
    Get September pitcher stats for selected players.

    Args:
        player_db_ids: List of original database player IDs

    Returns:
        List of stat dicts with frontend field names (uppercase)
    """
    db = SessionLocal()
    try:
        stmt = select(PitcherDailyStats).where(
            PitcherDailyStats.player_id.in_(player_db_ids),
            PitcherDailyStats.date >= date(2025, 9, 1),
            PitcherDailyStats.date <= date(2025, 9, 30),
        )
        stats = db.execute(stmt).scalars().all()

        logger.info(f"Found {len(stats)} pitcher stat rows")

        # Map to frontend format (lowercase → UPPERCASE)
        frontend_stats = []
        for stat in stats:
            frontend_stats.append(
                {
                    "player_id": stat.player_id,  # Will be remapped later
                    "date": stat.date.isoformat(),
                    "G": stat.g,
                    "GS": stat.gs,
                    "GF": stat.gf,
                    "CG": stat.cg,
                    "SHO": stat.sho,
                    "SV": stat.sv,
                    "HLD": stat.hld,
                    "IP_outs": stat.ip_outs,
                    "W": stat.w,
                    "L": stat.l,
                    "ER": stat.er,
                    "R": stat.r,
                    "BF": stat.bf,
                    "H": stat.h,
                    "BB": stat.bb,
                    "IBB": stat.ibb,
                    "HBP": stat.hbp,
                    "K": stat.k,
                    "HR": stat.hr,
                    "WP": stat.wp,
                    "BK": stat.bk,
                }
            )

        return frontend_stats

    finally:
        db.close()


def remap_player_ids(
    stats: list[dict], id_mapping: dict[int, int]
) -> list[dict]:
    """
    Remap player_id from DB IDs to sequential frontend IDs.

    Args:
        stats: List of stat dicts with DB player_ids
        id_mapping: Dict mapping DB ID → frontend ID

    Returns:
        Stats list with remapped player_ids
    """
    for stat in stats:
        db_id = stat["player_id"]
        if db_id in id_mapping:
            stat["player_id"] = id_mapping[db_id]
        else:
            # Should not happen, but log if it does
            logger.warning(f"Player ID {db_id} not found in mapping")

    return stats


def save_fixtures(
    players: list[dict], hitter_stats: list[dict], pitcher_stats: list[dict]
):
    """
    Save fixture files to frontend/lib/fixtures/.

    Args:
        players: List of player dicts
        hitter_stats: List of hitter stat dicts
        pitcher_stats: List of pitcher stat dicts
    """
    # Create directory if it doesn't exist
    FRONTEND_FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    # Remove _db_id from players before saving
    players_clean = [{k: v for k, v in p.items() if k != "_db_id"} for p in players]

    # Save players.json
    players_file = FRONTEND_FIXTURES_DIR / "players.json"
    with open(players_file, "w") as f:
        json.dump(players_clean, f, indent=2)
    logger.info(f"Saved {len(players_clean)} players to {players_file}")

    # Save hitter-stats.json
    hitter_file = FRONTEND_FIXTURES_DIR / "hitter-stats.json"
    with open(hitter_file, "w") as f:
        json.dump(hitter_stats, f, indent=2)
    logger.info(f"Saved {len(hitter_stats)} hitter stat rows to {hitter_file}")

    # Save pitcher-stats.json
    pitcher_file = FRONTEND_FIXTURES_DIR / "pitcher-stats.json"
    with open(pitcher_file, "w") as f:
        json.dump(pitcher_stats, f, indent=2)
    logger.info(f"Saved {len(pitcher_stats)} pitcher stat rows to {pitcher_file}")


def main():
    """Main execution function."""
    args = parse_args()

    logger.info("=" * 60)
    logger.info("Frontend Fixture Generation")
    logger.info("=" * 60)
    logger.info(f"Player limit: {args.limit}")
    logger.info(f"Output directory: {FRONTEND_FIXTURES_DIR}")
    logger.info("=" * 60)

    # Step 1: Get representative players
    logger.info("Step 1: Selecting representative players...")
    players = get_representative_players(args.limit)

    if not players:
        logger.error("No players found with September stats")
        return

    # Create ID mapping (DB ID → frontend ID)
    id_mapping = {p["_db_id"]: p["id"] for p in players}
    player_db_ids = [p["_db_id"] for p in players]

    # Step 2: Get stats
    logger.info("Step 2: Fetching stats from database...")
    hitter_stats = get_hitter_stats(player_db_ids)
    pitcher_stats = get_pitcher_stats(player_db_ids)

    # Step 3: Remap player IDs in stats
    logger.info("Step 3: Remapping player IDs...")
    hitter_stats = remap_player_ids(hitter_stats, id_mapping)
    pitcher_stats = remap_player_ids(pitcher_stats, id_mapping)

    # Step 4: Save fixtures
    logger.info("Step 4: Saving fixture files...")
    save_fixtures(players, hitter_stats, pitcher_stats)

    # Summary
    logger.info("=" * 60)
    logger.info("Summary:")
    logger.info(f"  Players: {len(players)}")
    logger.info(f"  Hitter stat rows: {len(hitter_stats)}")
    logger.info(f"  Pitcher stat rows: {len(pitcher_stats)}")
    logger.info("=" * 60)
    logger.info("✓ Fixture generation complete!")


if __name__ == "__main__":
    main()
