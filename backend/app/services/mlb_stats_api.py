"""
MLB Stats API service for fetching and parsing game boxscores.

The MLB Stats API provides game-level boxscores with stats for all players
who appeared in each game. This service handles fetching schedules, parsing
boxscores, and transforming API responses into our database format.

API Documentation:
- Base URL: https://statsapi.mlb.com/api/v1
- Schedule endpoint: /schedule?sportId=1&date={date}
- Boxscore endpoint: /game/{gamePk}/boxscore
- Date format for API URLs: MM/DD/YYYY
- Date format for stat dicts: YYYY-MM-DD
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# API Configuration
# DEPLOY: MLB_API_BASE_URL is configurable via env var (see config.py).
# Same proxy/egress notes as scoresheet_scraper.py.
MLB_STATS_BASE_URL = settings.MLB_API_BASE_URL
REQUEST_TIMEOUT = 10.0  # seconds


# Field mappings: API camelCase → DB lowercase
HITTER_FIELD_MAP = {
    "gamesPlayed": "g",
    "plateAppearances": "pa",
    "atBats": "ab",
    "hits": "h",
    "doubles": "double",
    "triples": "triple",
    "homeRuns": "hr",
    "totalBases": "tb",
    "runs": "r",
    "rbi": "rbi",
    "strikeOuts": "so",
    "groundOuts": "go",
    "flyOuts": "fo",
    "airOuts": "ao",
    "groundIntoDoublePlay": "gdp",
    "baseOnBalls": "bb",
    "intentionalWalks": "ibb",
    "hitByPitch": "hbp",
    "stolenBases": "sb",
    "caughtStealing": "cs",
    "sacFlies": "sf",
    "sacBunts": "sh",
    "leftOnBase": "lob",
}

PITCHER_FIELD_MAP = {
    "gamesPlayed": "g",
    "gamesStarted": "gs",
    "gamesFinished": "gf",
    "completeGames": "cg",
    "shutouts": "sho",
    "saves": "sv",
    "saveOpportunities": "svo",
    "blownSaves": "bs",
    "holds": "hld",
    "outs": "ip_outs",  # Direct mapping, already an integer
    "wins": "w",
    "losses": "l",
    "earnedRuns": "er",
    "runs": "r",
    "battersFaced": "bf",
    "atBats": "ab",
    "hits": "h",
    "doubles": "double",
    "triples": "triple",
    "homeRuns": "hr",
    "totalBases": "tb",
    "baseOnBalls": "bb",
    "intentionalWalks": "ibb",
    "hitByPitch": "hbp",
    "strikeOuts": "k",
    "groundOuts": "go",
    "flyOuts": "fo",
    "airOuts": "ao",
    "stolenBases": "sb",
    "caughtStealing": "cs",
    "sacFlies": "sf",
    "sacBunts": "sh",
    "wildPitches": "wp",
    "balks": "bk",
    "pickoffs": "pk",
    "inheritedRunners": "ir",
    "inheritedRunnersScored": "irs",
    "numberOfPitches": "pitches",
    "strikes": "strikes",
}


def build_schedule_url(date_str: str) -> str:
    """
    Build MLB Schedule API URL.

    Args:
        date_str: Date in YYYY-MM-DD format

    Returns:
        Full API URL with date in MM/DD/YYYY format
    """
    d = datetime.strptime(date_str, "%Y-%m-%d")
    api_date = d.strftime("%m/%d/%Y")
    return f"{MLB_STATS_BASE_URL}/schedule?sportId=1&date={api_date}"


def build_boxscore_url(game_pk: int) -> str:
    """
    Build MLB Boxscore API URL.

    Args:
        game_pk: MLB game ID

    Returns:
        Full API URL
    """
    return f"{MLB_STATS_BASE_URL}/game/{game_pk}/boxscore"


async def fetch_schedule(
    client: httpx.AsyncClient, date_str: str
) -> List[int]:
    """
    Fetch list of final game IDs for a date.

    Filters to games with abstractGameState == "Final",
    skipping postponed, suspended, or in-progress games.

    Args:
        client: httpx async client
        date_str: Date in YYYY-MM-DD format

    Returns:
        List of gamePk integers for completed games
    """
    url = build_schedule_url(date_str)

    try:
        response = await client.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as e:
        logger.warning(f"HTTP error fetching schedule for {date_str}: {e}")
        return []
    except httpx.RequestError as e:
        logger.warning(f"Request error fetching schedule for {date_str}: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching schedule for {date_str}: {e}")
        return []

    game_pks = []
    for date_entry in data.get("dates", []):
        for game in date_entry.get("games", []):
            status = game.get("status", {})
            if status.get("abstractGameState") == "Final":
                game_pk = game.get("gamePk")
                if game_pk is not None:
                    game_pks.append(game_pk)

    logger.info(f"Found {len(game_pks)} final games for {date_str}")
    return game_pks


async def fetch_boxscore(
    client: httpx.AsyncClient, game_pk: int
) -> Optional[Dict[str, Any]]:
    """
    Fetch boxscore for a single game.

    Args:
        client: httpx async client
        game_pk: MLB game ID

    Returns:
        Raw boxscore JSON or None on error
    """
    url = build_boxscore_url(game_pk)

    try:
        response = await client.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.debug(f"No boxscore found for game {game_pk}")
        else:
            logger.warning(
                f"HTTP error fetching boxscore for game {game_pk}: {e}"
            )
        return None
    except httpx.RequestError as e:
        logger.warning(f"Request error fetching boxscore for game {game_pk}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching boxscore for game {game_pk}: {e}")
        return None


def parse_boxscore(
    boxscore: Dict[str, Any],
    date_str: str,
    mlb_id_to_player_ids: Dict[int, Dict[str, int]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[int, Dict[str, str]]]:
    """
    Parse boxscore response into hitter and pitcher stat dicts.

    Iterates over all players in both teams. For each player:
    - Batting stats with PA > 0 → hitter row (mapped via HITTER_FIELD_MAP)
    - Pitching stats with outs > 0 or BF > 0 → pitcher row (mapped via PITCHER_FIELD_MAP)

    Known players get player_id from the lookup dict. Unknown players get
    _mlb_id set instead (for later stub creation and reassignment by the
    calling script).

    Player ID lookup strategy for two-way players:
    - Batting stats: prefer "hitter" entry, fallback to "pitcher" (NL pitchers batting)
    - Pitching stats: prefer "pitcher" entry, fallback to "hitter" (position players pitching)

    Args:
        boxscore: Raw boxscore JSON from MLB API
        date_str: Date in YYYY-MM-DD format
        mlb_id_to_player_ids: {mlb_id: {"hitter": player_id, "pitcher": player_id}}

    Returns:
        Tuple of (hitter_stats, pitcher_stats, unknown_player_info)
        - hitter/pitcher_stats: dicts with player_id (known) or _mlb_id (unknown)
        - unknown_player_info: {mlb_id: {"first_name": ..., "last_name": ..., "position": ...}}
    """
    hitter_stats: List[Dict[str, Any]] = []
    pitcher_stats: List[Dict[str, Any]] = []
    unknown_player_info: Dict[int, Dict[str, str]] = {}

    teams = boxscore.get("teams", {})
    for side in ("away", "home"):
        team_data = teams.get(side, {})
        players = team_data.get("players", {})

        for player_key, player_data in players.items():
            # Extract mlb_id from "ID{mlb_id}" key
            if not player_key.startswith("ID"):
                continue
            try:
                mlb_id = int(player_key[2:])
            except (ValueError, TypeError):
                continue

            person = player_data.get("person", {})
            player_stats = player_data.get("stats", {})
            position = player_data.get("position", {})

            lookup_entry = mlb_id_to_player_ids.get(mlb_id, {})

            # --- Batting stats ---
            batting = player_stats.get("batting", {})
            if batting and batting.get("plateAppearances", 0) > 0:
                player_id = lookup_entry.get("hitter") or lookup_entry.get("pitcher")

                row: Dict[str, Any] = {"date": date_str}
                if player_id:
                    row["player_id"] = player_id
                else:
                    row["_mlb_id"] = mlb_id
                    _collect_unknown(unknown_player_info, mlb_id, person, position)

                for api_field, db_field in HITTER_FIELD_MAP.items():
                    row[db_field] = batting.get(api_field, 0)

                # Derive singles: single = h - 2b - 3b - hr
                row["single"] = (
                    row.get("h", 0)
                    - row.get("double", 0)
                    - row.get("triple", 0)
                    - row.get("hr", 0)
                )

                hitter_stats.append(row)

            # --- Pitching stats ---
            pitching = player_stats.get("pitching", {})
            if pitching and (
                pitching.get("outs", 0) > 0
                or pitching.get("battersFaced", 0) > 0
            ):
                player_id = lookup_entry.get("pitcher") or lookup_entry.get("hitter")

                row = {"date": date_str}
                if player_id:
                    row["player_id"] = player_id
                else:
                    row["_mlb_id"] = mlb_id
                    _collect_unknown(unknown_player_info, mlb_id, person, position)

                for api_field, db_field in PITCHER_FIELD_MAP.items():
                    row[db_field] = pitching.get(api_field, 0)

                pitcher_stats.append(row)

    return hitter_stats, pitcher_stats, unknown_player_info


def _collect_unknown(
    unknown_info: Dict[int, Dict[str, str]],
    mlb_id: int,
    person: Dict[str, Any],
    position: Dict[str, Any],
) -> None:
    """Collect info for an unknown player (not yet in our database)."""
    if mlb_id in unknown_info:
        return

    full_name = person.get("fullName", "Unknown")
    parts = full_name.split(" ", 1)
    unknown_info[mlb_id] = {
        "first_name": parts[0],
        "last_name": parts[1] if len(parts) > 1 else "",
        "position": position.get("abbreviation", ""),
    }


async def fetch_daily_boxscores(
    date_str: str,
    mlb_id_to_player_ids: Dict[int, Dict[str, int]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[int, Dict[str, str]]]:
    """
    Fetch and parse all boxscores for a single date.

    Orchestrates: fetch_schedule → fetch_boxscore per game → parse_boxscore.
    Handles partial failures (if one game's boxscore fails, others continue).

    Args:
        date_str: Date in YYYY-MM-DD format
        mlb_id_to_player_ids: {mlb_id: {"hitter": player_id, "pitcher": player_id}}

    Returns:
        Tuple of (hitter_stats, pitcher_stats, unknown_player_info)
    """
    all_hitter_stats: List[Dict[str, Any]] = []
    all_pitcher_stats: List[Dict[str, Any]] = []
    all_unknown_info: Dict[int, Dict[str, str]] = {}

    async with httpx.AsyncClient() as client:
        game_pks = await fetch_schedule(client, date_str)

        if not game_pks:
            return [], [], {}

        for game_pk in game_pks:
            boxscore = await fetch_boxscore(client, game_pk)
            if boxscore is None:
                continue

            hitter_stats, pitcher_stats, unknown_info = parse_boxscore(
                boxscore, date_str, mlb_id_to_player_ids
            )

            all_hitter_stats.extend(hitter_stats)
            all_pitcher_stats.extend(pitcher_stats)
            all_unknown_info.update(unknown_info)

    logger.info(
        f"Fetched {len(all_hitter_stats)} hitter rows, "
        f"{len(all_pitcher_stats)} pitcher rows from {len(game_pks)} games"
    )

    return all_hitter_stats, all_pitcher_stats, all_unknown_info


def aggregate_stats_by_player_date(
    stats: List[Dict[str, Any]], derive_singles: bool = False
) -> List[Dict[str, Any]]:
    """
    Aggregate stats by (player_id, date), summing all numeric fields.

    Handles doubleheaders where the same player appears in 2+ boxscores
    on the same date. Groups by player identifier and date, then sums
    all numeric stat fields.

    Args:
        stats: List of stat dicts (with player_id or _mlb_id)
        derive_singles: If True, recalculate single = h - 2b - 3b - hr
                        after summing (use for hitter stats)

    Returns:
        List of aggregated stat dicts (one per player per date)
    """
    if not stats:
        return []

    groups: Dict[tuple, Dict[str, Any]] = {}

    for row in stats:
        # Group key: use player_id for known players, _mlb_id for unknowns
        id_val = row.get("player_id") or ("_mlb", row.get("_mlb_id"))
        key = (id_val, row["date"])

        if key not in groups:
            groups[key] = dict(row)
        else:
            existing = groups[key]
            for field, value in row.items():
                if field in ("player_id", "_mlb_id", "date"):
                    continue
                if isinstance(value, (int, float)):
                    existing[field] = existing.get(field, 0) + value

    result = list(groups.values())

    if derive_singles:
        for row in result:
            row["single"] = (
                row.get("h", 0)
                - row.get("double", 0)
                - row.get("triple", 0)
                - row.get("hr", 0)
            )

    return result
