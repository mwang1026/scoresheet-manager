"""
IL status fetcher service.

Fetches injured list data from the MLB Stats API and persists it to the
players table. Two-phase approach:
  1. Fetch all 30 team rosters to identify IL players
  2. Fetch transactions for matched Scoresheet players to get IL placement date
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import date

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.player import Player

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MLB_STATS_BASE_URL = settings.MLB_API_BASE_URL
REQUEST_TIMEOUT = 10.0
RATE_LIMIT_DELAY = 0.075  # 75ms between requests
MAX_RETRIES = 3

# All 30 MLB team IDs
MLB_TEAM_IDS = (
    108, 109, 110, 111, 112,  # LAA, ARI, BAL, BOS, CHC
    113, 114, 115, 116, 117,  # CIN, CLE, COL, DET, HOU
    118, 119, 120, 121, 133,  # KC, LAD, WSH, NYM, OAK
    134, 135, 136, 137, 138,  # PIT, SD, SEA, SF, STL
    139, 140, 141, 142, 143,  # TB, TEX, TOR, MIN, PHI
    144, 145, 146, 147, 158,  # ATL, CWS, MIA, NYY, MIL
)

# MLB roster status codes → human-readable IL type
IL_STATUS_CODES: dict[str, str] = {
    "D7": "7-Day IL",
    "D10": "10-Day IL",
    "D15": "15-Day IL",
    "D60": "60-Day IL",
}


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------


@dataclass
class ILEntry:
    """A player identified as being on the injured list."""

    mlb_id: int
    il_type: str  # e.g. "10-Day IL", "60-Day IL"
    full_name: str  # for logging


# ---------------------------------------------------------------------------
# Fetch helpers
# ---------------------------------------------------------------------------


async def fetch_team_roster(
    client: httpx.AsyncClient,
    team_id: int,
    season: int,
) -> list[dict] | None:
    """Fetch fullRoster for one MLB team with retry on server errors."""
    url = (
        f"{MLB_STATS_BASE_URL}/teams/{team_id}/roster"
        f"?rosterType=fullRoster&season={season}"
    )

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            return data.get("roster", [])
        except httpx.HTTPStatusError as e:
            if e.response.status_code < 500:
                logger.warning(
                    "HTTP %d fetching roster for team %d: %s",
                    e.response.status_code, team_id, e,
                )
                return None
            if attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                logger.warning(
                    "Server error %d for team %d, retrying in %ds (attempt %d/%d)",
                    e.response.status_code, team_id, wait, attempt + 1, MAX_RETRIES,
                )
                await asyncio.sleep(wait)
            else:
                logger.warning(
                    "Failed to fetch roster for team %d after %d retries",
                    team_id, MAX_RETRIES,
                )
                return None
        except httpx.RequestError as e:
            if attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                logger.warning(
                    "Connection error for team %d, retrying in %ds (attempt %d/%d): %s",
                    team_id, wait, attempt + 1, MAX_RETRIES, e,
                )
                await asyncio.sleep(wait)
            else:
                logger.warning(
                    "Failed to fetch roster for team %d after %d retries: %s",
                    team_id, MAX_RETRIES, e,
                )
                return None

    return None  # pragma: no cover


def parse_il_entries(roster: list[dict]) -> list[ILEntry]:
    """Filter roster for IL players and return ILEntry objects."""
    entries = []
    for player in roster:
        status = player.get("status", {})
        code = status.get("code", "")
        if not code.startswith("D"):
            continue

        person = player.get("person", {})
        mlb_id = person.get("id")
        if not mlb_id:
            continue

        il_type = IL_STATUS_CODES.get(code, status.get("description", code))
        full_name = person.get("fullName", f"ID {mlb_id}")
        entries.append(ILEntry(mlb_id=mlb_id, il_type=il_type, full_name=full_name))

    return entries


async def fetch_il_date(
    client: httpx.AsyncClient,
    mlb_id: int,
) -> date | None:
    """Fetch most recent IL placement date from player transactions."""
    url = (
        f"{MLB_STATS_BASE_URL}/people/{mlb_id}"
        f"?hydrate=transactions(type=[StatusChange])"
    )

    try:
        response = await client.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.warning("Failed to fetch transactions for player %d: %s", mlb_id, e)
        return None

    people = data.get("people", [])
    if not people:
        return None

    transactions = people[0].get("transactions", [])

    # Find most recent IL placement (iterate in order, last match wins)
    il_date = None
    for txn in transactions:
        desc = (txn.get("description") or "").lower()
        if "injured list" in desc:
            effective = txn.get("effectiveDate")
            if effective:
                try:
                    il_date = date.fromisoformat(effective)
                except ValueError:
                    continue

    return il_date


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def fetch_and_persist_il_status(session: AsyncSession) -> dict:
    """
    Fetch IL status from MLB rosters and persist to the players table.

    Returns summary dict with counts for logging/monitoring.
    """
    season = settings.SEED_LEAGUE_SEASON

    # Step 1: Build lookup of Scoresheet players by mlb_id
    result = await session.execute(
        select(Player).where(Player.scoresheet_only(), Player.mlb_id.isnot(None))
    )
    scoresheet_players = result.scalars().all()
    player_by_mlb_id: dict[int, list[Player]] = {}
    for p in scoresheet_players:
        player_by_mlb_id.setdefault(p.mlb_id, []).append(p)

    # Step 2: Fetch all 30 team rosters
    teams_fetched = 0
    teams_failed = 0
    all_il_entries: list[ILEntry] = []

    async with httpx.AsyncClient() as client:
        for i, team_id in enumerate(MLB_TEAM_IDS):
            roster = await fetch_team_roster(client, team_id, season)

            if roster is None:
                teams_failed += 1
            else:
                teams_fetched += 1
                entries = parse_il_entries(roster)
                all_il_entries.extend(entries)

            # Rate limiting
            if i < len(MLB_TEAM_IDS) - 1:
                await asyncio.sleep(RATE_LIMIT_DELAY)

        # Step 3: Deduplicate by mlb_id (keep first occurrence)
        seen: set[int] = set()
        unique_entries: list[ILEntry] = []
        for entry in all_il_entries:
            if entry.mlb_id not in seen:
                seen.add(entry.mlb_id)
                unique_entries.append(entry)

        # Step 4: Intersect with Scoresheet players
        matched_entries = [e for e in unique_entries if e.mlb_id in player_by_mlb_id]
        il_mlb_ids: set[int] = {e.mlb_id for e in matched_entries}

        logger.info(
            "Found %d IL players across %d teams (%d matched Scoresheet players)",
            len(unique_entries), teams_fetched, len(matched_entries),
        )

        # Step 5: Fetch il_date for each matched player
        il_dates: dict[int, date | None] = {}
        for j, entry in enumerate(matched_entries):
            il_dates[entry.mlb_id] = await fetch_il_date(client, entry.mlb_id)
            if j < len(matched_entries) - 1:
                await asyncio.sleep(RATE_LIMIT_DELAY)

    # Step 6: Bulk update IL players
    players_added = 0
    for entry in matched_entries:
        il_date_val = il_dates.get(entry.mlb_id)
        await session.execute(
            update(Player)
            .where(Player.mlb_id == entry.mlb_id, Player.scoresheet_only())
            .values(il_type=entry.il_type, il_date=il_date_val)
        )
        players_added += len(player_by_mlb_id.get(entry.mlb_id, []))

    # Step 7: Clear IL status for players no longer on IL
    # Safeguard: skip if ALL team fetches failed (network outage protection)
    players_cleared = 0
    if teams_fetched > 0:
        previously_il = await session.execute(
            select(Player).where(
                Player.scoresheet_only(),
                Player.il_type.isnot(None),
                Player.mlb_id.isnot(None),
            )
        )
        for p in previously_il.scalars().all():
            if p.mlb_id not in il_mlb_ids:
                await session.execute(
                    update(Player)
                    .where(Player.id == p.id)
                    .values(il_type=None, il_date=None)
                )
                players_cleared += 1
    else:
        logger.warning(
            "All %d team fetches failed — preserving existing IL data",
            len(MLB_TEAM_IDS),
        )

    await session.commit()

    summary = {
        "teams_fetched": teams_fetched,
        "teams_failed": teams_failed,
        "il_players_found": len(unique_entries),
        "scoresheet_matches": len(matched_entries),
        "players_added_to_il": players_added,
        "players_cleared_from_il": players_cleared,
    }
    logger.info("IL status update summary: %s", summary)
    return summary
