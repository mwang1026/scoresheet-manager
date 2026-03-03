"""
Player matching for news items — 7-step cascade.

Matches scraped player names to our Player database using exact name,
MLB API lookup, and fuzzy matching as fallbacks.
"""

import logging
from dataclasses import dataclass
from enum import Enum

import httpx
from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.player import Player
from app.services.name_matching import normalize_for_match

logger = logging.getLogger(__name__)

FUZZY_THRESHOLD = 90
MLB_API_SEARCH_URL = f"{settings.MLB_API_BASE_URL}/people/search"
MLB_API_TIMEOUT = 10.0


class MatchMethod(str, Enum):
    exact_name_team = "exact_name_team"
    exact_name_only = "exact_name_only"
    mlb_api_name_team = "mlb_api_name_team"
    mlb_api_name_only = "mlb_api_name_only"
    fuzzy_name_team = "fuzzy_name_team"
    fuzzy_name_only = "fuzzy_name_only"
    unmatched = "unmatched"


@dataclass
class MatchResult:
    player_id: int | None
    method: MatchMethod
    confidence: float


@dataclass
class _CachedPlayer:
    """Lightweight player record for in-memory matching."""

    id: int
    first_name: str
    last_name: str
    full_name: str  # pre-computed "first last"
    current_mlb_team: str | None
    mlb_id: int | None


def _split_name(full_name: str) -> tuple[str, str]:
    """
    Split a full name into (first_name, last_name).

    Handles:
    - "Mike Trout" → ("Mike", "Trout")
    - "J.D. Martinez" → ("J.D.", "Martinez")
    - "Vladimir Guerrero Jr." → ("Vladimir", "Guerrero Jr.")
    - "Shohei Ohtani" → ("Shohei", "Ohtani")
    - Single name "Ohtani" → ("", "Ohtani")
    """
    parts = full_name.strip().split()
    if len(parts) == 0:
        return ("", "")
    if len(parts) == 1:
        return ("", parts[0])

    first = parts[0]

    # Check if last part is a suffix like Jr., Sr., II, III, IV
    suffixes = {"jr.", "sr.", "ii", "iii", "iv", "v"}
    if len(parts) > 2 and parts[-1].lower().rstrip(".") in {s.rstrip(".") for s in suffixes}:
        last = " ".join(parts[1:])
    else:
        last = " ".join(parts[1:])

    return (first, last)


async def _load_scoresheet_players(session: AsyncSession) -> list[_CachedPlayer]:
    """Load all Scoresheet players into memory for matching."""
    result = await session.execute(
        select(
            Player.id,
            Player.first_name,
            Player.last_name,
            Player.current_mlb_team,
            Player.mlb_id,
        ).where(Player.scoresheet_only())
    )
    players = []
    for row in result.all():
        players.append(
            _CachedPlayer(
                id=row.id,
                first_name=row.first_name,
                last_name=row.last_name,
                full_name=f"{row.first_name} {row.last_name}",
                current_mlb_team=row.current_mlb_team,
                mlb_id=row.mlb_id,
            )
        )
    return players


def _exact_match(
    players: list[_CachedPlayer], first_name: str, last_name: str, team_abbr: str | None
) -> MatchResult | None:
    """Steps 1-2: Exact first+last name match, with and without team."""
    matches_name: list[_CachedPlayer] = []
    first_norm = normalize_for_match(first_name)
    last_norm = normalize_for_match(last_name)
    for p in players:
        if normalize_for_match(p.first_name) == first_norm and normalize_for_match(p.last_name) == last_norm:
            matches_name.append(p)

    if not matches_name:
        return None

    # Step 1: exact name + team
    if team_abbr:
        for p in matches_name:
            if p.current_mlb_team == team_abbr:
                return MatchResult(
                    player_id=p.id,
                    method=MatchMethod.exact_name_team,
                    confidence=1.0,
                )

    # Step 2: exact name only (use first match)
    return MatchResult(
        player_id=matches_name[0].id,
        method=MatchMethod.exact_name_only,
        confidence=0.9,
    )


async def _mlb_api_match(
    players: list[_CachedPlayer],
    full_name: str,
    team_abbr: str | None,
    http_client: httpx.AsyncClient,
) -> MatchResult | None:
    """Steps 3-4: MLB API people search → look up by mlb_id."""
    try:
        response = await http_client.get(
            MLB_API_SEARCH_URL,
            params={"names": full_name, "sportId": 1},
            timeout=MLB_API_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except Exception:
        logger.debug("MLB API search failed for %r", full_name, exc_info=True)
        return None

    people = data.get("people", [])
    if not people:
        return None

    # Build a set of mlb_ids from the API response
    api_mlb_ids = [p.get("id") for p in people if p.get("id")]

    # Build lookup from mlb_id → player for our Scoresheet players
    mlb_id_map: dict[int, _CachedPlayer] = {}
    for p in players:
        if p.mlb_id and p.mlb_id in api_mlb_ids:
            mlb_id_map[p.mlb_id] = p

    if not mlb_id_map:
        return None

    # Step 3: mlb_api + team match
    if team_abbr:
        for mlb_id, p in mlb_id_map.items():
            if p.current_mlb_team == team_abbr:
                return MatchResult(
                    player_id=p.id,
                    method=MatchMethod.mlb_api_name_team,
                    confidence=0.95,
                )

    # Step 4: mlb_api name only (first match)
    first_match = next(iter(mlb_id_map.values()))
    return MatchResult(
        player_id=first_match.id,
        method=MatchMethod.mlb_api_name_only,
        confidence=0.85,
    )


def _fuzzy_match(
    players: list[_CachedPlayer], full_name: str, team_abbr: str | None
) -> MatchResult | None:
    """Steps 5-6: Fuzzy name matching with rapidfuzz."""
    best_ratio = 0.0
    best_player: _CachedPlayer | None = None
    best_with_team: _CachedPlayer | None = None
    best_team_ratio = 0.0

    for p in players:
        ratio = fuzz.token_sort_ratio(full_name.lower(), p.full_name.lower())
        if ratio >= FUZZY_THRESHOLD:
            if team_abbr and p.current_mlb_team == team_abbr and ratio > best_team_ratio:
                best_team_ratio = ratio
                best_with_team = p
            if ratio > best_ratio:
                best_ratio = ratio
                best_player = p

    # Step 5: fuzzy + team
    if best_with_team:
        return MatchResult(
            player_id=best_with_team.id,
            method=MatchMethod.fuzzy_name_team,
            confidence=best_team_ratio / 100.0,
        )

    # Step 6: fuzzy only (discounted)
    if best_player:
        return MatchResult(
            player_id=best_player.id,
            method=MatchMethod.fuzzy_name_only,
            confidence=(best_ratio / 100.0) * 0.9,
        )

    return None


async def match_player(
    players: list[_CachedPlayer],
    full_name: str,
    team_abbr: str | None,
    http_client: httpx.AsyncClient,
) -> MatchResult:
    """
    Match a player name to a Scoresheet player using the 7-step cascade.

    Steps: exact_name_team → exact_name_only → mlb_api_name_team →
    mlb_api_name_only → fuzzy_name_team → fuzzy_name_only → unmatched
    """
    first_name, last_name = _split_name(full_name)

    # Steps 1-2: Exact match
    if first_name and last_name:
        result = _exact_match(players, first_name, last_name, team_abbr)
        if result:
            return result

    # Steps 3-4: MLB API search
    result = await _mlb_api_match(players, full_name, team_abbr, http_client)
    if result:
        return result

    # Steps 5-6: Fuzzy match
    result = _fuzzy_match(players, full_name, team_abbr)
    if result:
        return result

    # Step 7: Unmatched
    return MatchResult(player_id=None, method=MatchMethod.unmatched, confidence=0.0)


async def match_players_batch(
    session: AsyncSession,
    items: list[tuple[str, str | None]],
) -> list[MatchResult]:
    """
    Match a batch of (player_name, team_abbr) pairs.

    Pre-loads all Scoresheet players once and shares the cache across items.
    Uses a single httpx client for any MLB API lookups.
    """
    players = await _load_scoresheet_players(session)
    logger.info("Loaded %d Scoresheet players for matching", len(players))

    results: list[MatchResult] = []
    async with httpx.AsyncClient() as http_client:
        for full_name, team_abbr in items:
            result = await match_player(players, full_name, team_abbr, http_client)
            results.append(result)

    return results
