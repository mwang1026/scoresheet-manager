"""Shared player name matching for projection imports and news scraping.

Consolidates team abbreviation maps, name normalization, and player lookup
logic used by ATC prepare scripts, PECOTA imports, and the news scraper.
"""

import re
import unicodedata

from sqlalchemy import select

from app.models import Player

# ---------------------------------------------------------------------------
# Team abbreviation maps
# ---------------------------------------------------------------------------

# Merged superset: maps FanGraphs/ATC and RotoWire abbreviations → Scoresheet.
TEAM_ABBR_MAP: dict[str, str] = {
    "ARI": "Ari", "ATL": "Atl", "BAL": "Bal", "BOS": "Bos",
    "CHC": "ChN", "CHW": "ChA", "CWS": "ChA",
    "CIN": "Cin", "CLE": "Cle", "COL": "Col", "DET": "Det",
    "HOU": "Hou", "KC": "KC", "KCR": "KC",
    "LAA": "LAA", "LAD": "LAD", "MIA": "Mia", "MIL": "Mil",
    "MIN": "Min", "NYM": "NYN", "NYY": "NYA",
    "ATH": "Ath", "OAK": "Ath",
    "PHI": "Phi", "PIT": "Pit",
    "SD": "SD", "SDP": "SD",
    "SEA": "Sea", "SF": "SF", "SFG": "SF",
    "STL": "StL", "TB": "TB", "TBR": "TB",
    "TEX": "Tex", "TOR": "Tor",
    "WAS": "Was", "WSH": "Was", "WSN": "Was",
}

# Backward-compatible aliases — same underlying dict.
FANGRAPHS_TEAM_MAP: dict[str, str] = TEAM_ABBR_MAP
ROTOWIRE_TEAM_MAP: dict[str, str] = TEAM_ABBR_MAP

# ---------------------------------------------------------------------------
# Player name overrides
# ---------------------------------------------------------------------------

# Manual overrides for players whose external names can't be resolved
# algorithmically. Keyed by (external_name, scoresheet_team_abbr).
# Consumers must translate source team abbr → Scoresheet via TEAM_ABBR_MAP
# before checking this dict.
PLAYER_NAME_OVERRIDES: dict[tuple[str, str], str] = {
    ("Jung Hoo Lee", "SF"): "JungHoo Lee",
    ("Ji Hwan Bae", "NYN"): "Ji Hwan Bae",
    ("Chen Zhong-Ao Zhuang", "Ath"): "ChenZhong-Ao Zhuang",
    ("Dom Keegan", "TB"): "Dominic Keegan",
    ("Dom Hamel", "NYA"): "Dominic Hamel",
    ("Dax Fulton", "Mia"): "Daxton Fulton",
    ("Leo De Vries", "Ath"): "Leodalis DeVries",
}

# ---------------------------------------------------------------------------
# Name normalization
# ---------------------------------------------------------------------------

# Suffixes to strip when splitting names.
NAME_SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}

# Regex: trailing capital + optional dot preceded by lowercase.
# Matches "EuryR." → strips "R.", "JoshH." → strips "H."
# Won't fire on "DJ" (all caps) or normal names.
_TRAILING_MIDDLE_INITIAL_RE = re.compile(r"(?<=[a-z])[A-Z]\.?$")


def normalize_name(name: str) -> str:
    """Normalize a name for comparison: strip accents, parens, suffixes, middle initials, lowercase."""
    # Decompose unicode and strip combining marks (accents)
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Strip parenthetical annotations: (hurt), (Clark), (LAA), etc.
    ascii_str = re.sub(r"\([^)]*\)", "", ascii_str)
    # Strip two-way player suffixes: -H, -P at end of name
    ascii_str = re.sub(r"-(H|P)$", "", ascii_str, flags=re.IGNORECASE)
    # Strip trailing middle initials: "EuryR." → "Eury", "JoshH." → "Josh"
    ascii_str = _TRAILING_MIDDLE_INITIAL_RE.sub("", ascii_str.strip())
    return ascii_str.lower().strip().replace(".", "")


def normalize_for_match(name: str) -> str:
    """Normalize + strip all spaces for comparison.

    "De La Cruz" and "DeLaCruz" both become "delacruz".
    """
    return normalize_name(name).replace(" ", "")


def split_name(full_name: str) -> tuple[str, str]:
    """Split 'First Last' or 'First Last Jr.' into (first, last) normalized.

    Strips trailing suffixes (Jr., Sr., II, III, IV) and single-letter-dot
    middle-name tokens ("Jose A. Ferrer" → first="jose", last="ferrer").
    """
    parts = full_name.strip().split()
    if len(parts) < 2:
        return normalize_name(full_name), ""

    # Strip trailing suffixes
    while len(parts) > 2 and parts[-1].lower().rstrip(".") in {s.rstrip(".") for s in NAME_SUFFIXES}:
        parts = parts[:-1]

    # Strip single-letter-dot tokens in middle positions (not first token).
    # "Jose A. Ferrer" → ["Jose", "Ferrer"]
    filtered = [parts[0]]
    for token in parts[1:]:
        if re.match(r"^[A-Za-z]\.?$", token):
            continue
        filtered.append(token)
    # Only use filtered if it still has at least 2 parts
    if len(filtered) >= 2:
        parts = filtered

    first = normalize_name(parts[0])
    last = normalize_name(" ".join(parts[1:]))
    return first, last


# ---------------------------------------------------------------------------
# Player database lookups
# ---------------------------------------------------------------------------


def build_player_lookups(db) -> tuple[dict, dict]:
    """Build lookup dicts from database players.

    Returns:
        exact_lookup: (first_match, last_match, scoresheet_team) -> mlb_id
            Keys use normalize_for_match (spaces stripped) for compound name matching.
        name_lookup: (first_match, last_match) -> [(mlb_id, primary_position)]
            Keys use normalize_for_match (spaces stripped) for compound name matching.
    """
    players = db.execute(
        select(
            Player.first_name,
            Player.last_name,
            Player.mlb_id,
            Player.current_mlb_team,
            Player.primary_position,
        ).where(Player.mlb_id.isnot(None))
    ).all()

    exact_lookup: dict[tuple[str, str, str], int] = {}
    name_lookup: dict[tuple[str, str], list[tuple[int, str]]] = {}

    for first_name, last_name, mlb_id, team, position in players:
        first_norm = normalize_for_match(first_name)
        last_norm = normalize_for_match(last_name)

        # Strip trailing "jr"/"sr" from DB first names (e.g. "vladimirjr" → "vladimir")
        for suffix in ("jr", "sr"):
            if first_norm.endswith(suffix) and len(first_norm) > len(suffix) + 1:
                first_norm = first_norm[: -len(suffix)].strip()
                break

        # Exact match with team
        if team:
            exact_lookup[(first_norm, last_norm, team)] = mlb_id

        # Name-only fallback
        key = (first_norm, last_norm)
        if key not in name_lookup:
            name_lookup[key] = []
        name_lookup[key].append((mlb_id, position))

    return exact_lookup, name_lookup


def match_player(
    first: str,
    last: str,
    scoresheet_team: str | None,
    exact_lookup: dict,
    name_lookup: dict,
    *,
    prefer_pitcher: bool = False,
) -> int | None:
    """Try to match a player to an mlb_id.

    Strategy:
    1. Exact (first, last, team) match
    2. Name-only match — prefer pitcher or non-pitcher based on context

    Args:
        first: Normalized first name (from split_name).
        last: Normalized last name (from split_name).
        scoresheet_team: Scoresheet team abbreviation, or None.
        exact_lookup: From build_player_lookups.
        name_lookup: From build_player_lookups.
        prefer_pitcher: If True, prefer pitcher entries for two-way players.
            Default False (prefer hitter).
    """
    # Use normalize_for_match on incoming names too, for consistent compound-name matching
    first_match = first.replace(" ", "")
    last_match = last.replace(" ", "")

    # Strategy 1: exact name + team
    if scoresheet_team:
        mlb_id = exact_lookup.get((first_match, last_match, scoresheet_team))
        if mlb_id:
            return mlb_id

    # Strategy 2: name-only fallback
    candidates = name_lookup.get((first_match, last_match), [])
    if not candidates:
        return None

    if len(candidates) == 1:
        return candidates[0][0]

    # Multiple matches — prefer based on context
    if prefer_pitcher:
        preferred = [(mid, pos) for mid, pos in candidates if pos in ("P", "SR")]
    else:
        preferred = [(mid, pos) for mid, pos in candidates if pos not in ("P", "SR")]

    if preferred:
        return preferred[0][0]

    return candidates[0][0]
