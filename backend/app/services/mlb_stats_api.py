"""
MLB Stats API service for fetching and parsing player game logs.

The MLB Stats API provides game-by-game statistics for all MLB players.
This service handles fetching, parsing, and transforming API responses
into our database format.

API Documentation:
- Base URL: https://statsapi.mlb.com/api/v1
- Game log endpoint: /people/{mlb_id}/stats
- Date format: MM/DD/YYYY
"""

import asyncio
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
RATE_LIMIT_DELAY = 0.075  # 75ms between requests (~13 req/sec)


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
    "numberOfPitches": "pitches",
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


def build_game_log_url(
    mlb_id: int, group: str, season: int, start_date: str, end_date: str
) -> str:
    """
    Build MLB Stats API game log URL.

    Args:
        mlb_id: MLB player ID
        group: "hitting" or "pitching"
        season: Year (e.g., 2025)
        start_date: MM/DD/YYYY format
        end_date: MM/DD/YYYY format

    Returns:
        Full API URL
    """
    return (
        f"{MLB_STATS_BASE_URL}/people/{mlb_id}/stats"
        f"?stats=gameLog&season={season}&group={group}"
        f"&startDate={start_date}&endDate={end_date}"
    )


async def fetch_player_game_log(
    client: httpx.AsyncClient,
    mlb_id: int,
    group: str,
    start_date: str,
    end_date: str,
    season: int = 2025,
) -> Optional[Dict[str, Any]]:
    """
    Fetch a player's game log from MLB Stats API.

    Args:
        client: httpx async client
        mlb_id: MLB player ID
        group: "hitting" or "pitching"
        start_date: MM/DD/YYYY format
        end_date: MM/DD/YYYY format
        season: Year (default 2025)

    Returns:
        API response JSON or None on error
    """
    url = build_game_log_url(mlb_id, group, season, start_date, end_date)

    try:
        response = await client.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.debug(f"No data found for player {mlb_id} ({group})")
        else:
            logger.warning(
                f"HTTP error fetching {group} stats for player {mlb_id}: {e}"
            )
        return None
    except httpx.RequestError as e:
        logger.warning(f"Request error fetching stats for player {mlb_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching stats for player {mlb_id}: {e}")
        return None


def parse_hitter_game_log(
    api_response: Dict[str, Any], player_id: int
) -> List[Dict[str, Any]]:
    """
    Parse hitter game log API response into DB format.

    Handles:
    - Field mapping (API camelCase → DB lowercase)
    - Singles derivation (single = h - 2b - 3b - hr)
    - Doubleheader aggregation (same player + date)
    - Date format conversion (YYYY-MM-DD → date object)

    Args:
        api_response: Raw MLB Stats API response
        player_id: Database player ID

    Returns:
        List of dicts matching hitter_daily_stats schema
    """
    try:
        splits = api_response.get("stats", [{}])[0].get("splits", [])
    except (KeyError, IndexError):
        return []

    if not splits:
        return []

    # Group by date to handle doubleheaders
    games_by_date: Dict[str, Dict[str, int]] = {}

    for split in splits:
        date_str = split.get("date")  # YYYY-MM-DD
        stat = split.get("stat", {})

        if not date_str or not stat:
            continue

        # Initialize or get existing game for this date
        if date_str not in games_by_date:
            games_by_date[date_str] = {
                "player_id": player_id,
                "date": date_str,
            }

        game = games_by_date[date_str]

        # Map and aggregate fields
        for api_field, db_field in HITTER_FIELD_MAP.items():
            value = stat.get(api_field, 0)
            game[db_field] = game.get(db_field, 0) + value

    # Derive singles for each aggregated game
    result = []
    for game in games_by_date.values():
        # single = h - 2b - 3b - hr
        game["single"] = (
            game.get("h", 0)
            - game.get("double", 0)
            - game.get("triple", 0)
            - game.get("hr", 0)
        )
        result.append(game)

    return result


def parse_pitcher_game_log(
    api_response: Dict[str, Any], player_id: int
) -> List[Dict[str, Any]]:
    """
    Parse pitcher game log API response into DB format.

    Handles:
    - Field mapping (API camelCase → DB lowercase)
    - Doubleheader aggregation (same player + date)
    - Date format conversion (YYYY-MM-DD → date object)
    - Direct outs mapping (API 'outs' → DB 'ip_outs')

    Args:
        api_response: Raw MLB Stats API response
        player_id: Database player ID

    Returns:
        List of dicts matching pitcher_daily_stats schema
    """
    try:
        splits = api_response.get("stats", [{}])[0].get("splits", [])
    except (KeyError, IndexError):
        return []

    if not splits:
        return []

    # Group by date to handle doubleheaders
    games_by_date: Dict[str, Dict[str, int]] = {}

    for split in splits:
        date_str = split.get("date")  # YYYY-MM-DD
        stat = split.get("stat", {})

        if not date_str or not stat:
            continue

        # Initialize or get existing game for this date
        if date_str not in games_by_date:
            games_by_date[date_str] = {
                "player_id": player_id,
                "date": date_str,
            }

        game = games_by_date[date_str]

        # Map and aggregate fields
        for api_field, db_field in PITCHER_FIELD_MAP.items():
            value = stat.get(api_field, 0)
            game[db_field] = game.get(db_field, 0) + value

    return list(games_by_date.values())


async def fetch_all_player_stats(
    players: List[Dict[str, Any]],
    start_date: str,
    end_date: str,
    season: int = 2025,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Fetch game logs for all players with rate limiting and caching.

    Handles:
    - Rate limiting (75ms delay between requests)
    - Two-way players (cache by mlb_id + group)
    - Position-based group selection (P/SR → pitching, others → hitting)

    Args:
        players: List of player dicts with id, mlb_id, position
        start_date: MM/DD/YYYY format
        end_date: MM/DD/YYYY format
        season: Year (default 2025)

    Returns:
        Tuple of (hitter_stats, pitcher_stats) lists
    """
    hitter_stats = []
    pitcher_stats = []

    # Cache to avoid duplicate API calls for two-way players
    # Key: (mlb_id, group), Value: parsed stats
    cache: Dict[Tuple[int, str], List[Dict[str, Any]]] = {}

    async with httpx.AsyncClient() as client:
        for i, player in enumerate(players):
            player_id = player["id"]
            mlb_id = player.get("mlb_id")
            position = player.get("position", "")

            if not mlb_id:
                logger.debug(f"Skipping player {player_id}: no mlb_id")
                continue

            # Determine group based on position
            is_pitcher = position in ("P", "SR")
            group = "pitching" if is_pitcher else "hitting"

            # Check cache
            cache_key = (mlb_id, group)
            if cache_key in cache:
                logger.debug(
                    f"Using cached {group} stats for player {player_id} (mlb_id {mlb_id})"
                )
                cached_stats = cache[cache_key]
                # Update player_id for this specific player entry
                stats_for_player = [
                    {**stat, "player_id": player_id} for stat in cached_stats
                ]
                if is_pitcher:
                    pitcher_stats.extend(stats_for_player)
                else:
                    hitter_stats.extend(stats_for_player)
                continue

            # Fetch from API
            logger.info(
                f"Fetching {group} stats for player {player_id} "
                f"(mlb_id {mlb_id}) [{i+1}/{len(players)}]"
            )

            api_response = await fetch_player_game_log(
                client, mlb_id, group, start_date, end_date, season
            )

            if api_response is None:
                continue

            # Parse response
            if is_pitcher:
                stats = parse_pitcher_game_log(api_response, player_id)
                pitcher_stats.extend(stats)
            else:
                stats = parse_hitter_game_log(api_response, player_id)
                hitter_stats.extend(stats)

            # Cache for two-way players (store with player_id=0 as template)
            cache[cache_key] = [
                {k: v for k, v in stat.items() if k != "player_id"} for stat in stats
            ]

            # Rate limiting
            if i < len(players) - 1:  # Don't delay after last request
                await asyncio.sleep(RATE_LIMIT_DELAY)

    logger.info(
        f"Fetched {len(hitter_stats)} hitter stat rows, "
        f"{len(pitcher_stats)} pitcher stat rows"
    )

    return hitter_stats, pitcher_stats
