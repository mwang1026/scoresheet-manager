"""
Pure parsing for Scoresheet's Score-It game file (``FOR_WWW2/AG_<league>.js``).

The file holds every game played in the most recent completed week. Each
game is one ``f(...)`` call::

    f(8,0,"BiCoastal BiValves","Quad A Superstars",'<visitor>,<home>,<plays>',4,2,0);

* The first two args are 0-based team indexes (``scoresheet_id - 1``).
* The single-quoted payload has three comma-separated parts: the visitor's
  starting lineup, the home starting lineup, and the play-by-play string.
* A lineup is a run of tokens ``f<slot><pos><pin>`` — one digit batting slot
  (0-8, with 9 = starting pitcher), one digit position code, then the
  Scoresheet player pin. Tokens are delimited by the next ``f``.
* The play string contains the same ``f`` tokens for in-game substitutions
  (pitching changes, pinch hitters, defensive swaps) mixed with play codes.
  Substitutions are extracted best-effort; the play codes themselves are
  ignored.

No I/O and no eval — regex only. Format is undocumented and reverse
engineered from real files, so parse failures are logged and skipped
rather than raised.
"""

import logging
import re
from datetime import date

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Position codes used in lineup tokens (verified against the box score page).
POSITION_CODES: dict[int, str] = {
    0: "P",
    1: "C",
    2: "1B",
    3: "2B",
    4: "3B",
    5: "SS",
    6: "LF",
    7: "CF",
    8: "RF",
    9: "DH",
}

# Slot index used for the starting pitcher in a lineup header.
STARTING_PITCHER_SLOT = 9
PITCHER_POSITION_CODE = 0
LINEUP_HITTER_SLOTS = 9

_THRU_DATE_RE = re.compile(r"thru_date_\s*=\s*\"(\d{1,2})-(\d{1,2})-(\d{2})\"")

# One game record. Team names are double-quoted JS strings (may contain
# escaped quotes); the lineup payload is single-quoted and never contains
# quotes itself.
_GAME_RE = re.compile(
    r"^f\("
    r"(?P<v_idx>\d+),(?P<h_idx>\d+),"
    r"\"(?P<v_name>(?:[^\"\\]|\\.)*)\","
    r"\"(?P<h_name>(?:[^\"\\]|\\.)*)\","
    r"'(?P<payload>[^']*)',"
    r"(?P<v_score>-?\d+),(?P<h_score>-?\d+)",
    re.MULTILINE,
)

_LINEUP_TOKEN_RE = re.compile(r"f(\d)(\d)(\d+)")


class LineupEntry(BaseModel):
    """One lineup token: a player at a batting slot and position."""

    slot: int  # 0-8 batting order, 9 = starting pitcher
    position_code: int  # see POSITION_CODES
    pin: int  # Scoresheet player id

    @property
    def position(self) -> str:
        return POSITION_CODES.get(self.position_code, "?")


class ScrapedGame(BaseModel):
    """A single game from the Score-It file."""

    game_no: int  # 0-based order in the file
    visitor_idx: int  # 0-based team index
    home_idx: int
    visitor_name: str
    home_name: str
    visitor_lineup: list[LineupEntry]  # starters, slots 0-9
    home_lineup: list[LineupEntry]
    substitutions: list[LineupEntry]  # in-game tokens, team not identified
    visitor_score: int
    home_score: int


class ParsedLineups(BaseModel):
    """Parsed Score-It file."""

    thru_date: date | None
    games: list[ScrapedGame]


def parse_thru_date(js: str) -> date | None:
    """Parse ``var thru_date_ = "9-20-26";`` into a date (two-digit year)."""
    match = _THRU_DATE_RE.search(js)
    if not match:
        return None
    month, day, yy = (int(g) for g in match.groups())
    try:
        return date(2000 + yy, month, day)
    except ValueError:
        logger.warning("Score-It thru_date_ is not a valid date: %s", match.group(0))
        return None


def parse_lineup_tokens(segment: str) -> list[LineupEntry]:
    """Parse a run of ``f<slot><pos><pin>`` tokens."""
    return [
        LineupEntry(slot=int(slot), position_code=int(pos), pin=int(pin))
        for slot, pos, pin in _LINEUP_TOKEN_RE.findall(segment)
    ]


def _is_valid_starting_lineup(entries: list[LineupEntry]) -> bool:
    """A starting lineup has slots 0-8 exactly once plus one starting pitcher."""
    slots = sorted(e.slot for e in entries)
    return slots == list(range(LINEUP_HITTER_SLOTS + 1))


def parse_game_record(match: re.Match, game_no: int) -> ScrapedGame | None:
    """Build a ScrapedGame from a regex match, or None if the payload is malformed."""
    payload = match.group("payload")
    parts = payload.split(",")
    if len(parts) < 2:
        logger.warning(
            "Score-It game %d: payload has %d parts, expected lineups + plays; skipping",
            game_no,
            len(parts),
        )
        return None

    visitor_lineup = parse_lineup_tokens(parts[0])
    home_lineup = parse_lineup_tokens(parts[1])
    if not _is_valid_starting_lineup(visitor_lineup) or not _is_valid_starting_lineup(
        home_lineup
    ):
        logger.warning(
            "Score-It game %d (%s @ %s): starting lineup is not 9 hitters + 1 pitcher; skipping",
            game_no,
            match.group("v_name"),
            match.group("h_name"),
        )
        return None

    plays = ",".join(parts[2:])
    substitutions = parse_lineup_tokens(plays)

    return ScrapedGame(
        game_no=game_no,
        visitor_idx=int(match.group("v_idx")),
        home_idx=int(match.group("h_idx")),
        visitor_name=match.group("v_name"),
        home_name=match.group("h_name"),
        visitor_lineup=sorted(visitor_lineup, key=lambda e: e.slot),
        home_lineup=sorted(home_lineup, key=lambda e: e.slot),
        substitutions=substitutions,
        visitor_score=int(match.group("v_score")),
        home_score=int(match.group("h_score")),
    )


def parse_score_it_js(js: str) -> ParsedLineups:
    """
    Parse a Score-It game file into games with starting lineups.

    Malformed game records are logged and skipped; the rest are returned.
    ``game_no`` is the record's position in the file (skipped records still
    consume a number so ordering is stable).
    """
    thru_date = parse_thru_date(js)
    games: list[ScrapedGame] = []
    record_count = 0
    for match in _GAME_RE.finditer(js):
        game = parse_game_record(match, record_count)
        record_count += 1
        if game is not None:
            games.append(game)

    if record_count == 0:
        logger.warning("Score-It file contained no game records")

    return ParsedLineups(thru_date=thru_date, games=games)
