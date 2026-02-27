"""
RotoWire news page parser — pure functions, no I/O.

Parses HTML from https://www.rotowire.com/baseball/news.php into
structured ScrapedNewsItem objects.
"""

import logging
import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup, Tag
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Map RotoWire team abbreviations → Scoresheet DB current_mlb_team values.
# RotoWire uses standard uppercase; Scoresheet uses a mix of formats.
ROTOWIRE_TEAM_MAP: dict[str, str] = {
    "ARI": "Ari",
    "ATL": "Atl",
    "BAL": "Bal",
    "BOS": "Bos",
    "CHC": "ChN",
    "CHW": "ChA",
    "CWS": "ChA",
    "CIN": "Cin",
    "CLE": "Cle",
    "COL": "Col",
    "DET": "Det",
    "HOU": "Hou",
    "KC": "KC",
    "LAA": "LAA",
    "LAD": "LAD",
    "MIA": "Mia",
    "MIL": "Mil",
    "MIN": "Min",
    "NYM": "NYN",
    "NYY": "NYA",
    "ATH": "Ath",
    "OAK": "Ath",
    "PHI": "Phi",
    "PIT": "Pit",
    "SD": "SD",
    "SEA": "Sea",
    "SF": "SF",
    "STL": "StL",
    "TB": "TB",
    "TBR": "TB",
    "TEX": "Tex",
    "TOR": "Tor",
    "WAS": "Was",
    "WSH": "Was",
}

ROTOWIRE_BASE_URL = "https://www.rotowire.com"


class ScrapedNewsItem(BaseModel):
    player_name: str
    team_abbr: str | None
    headline: str
    body: str
    url: str
    published_at: datetime
    source: str = "RotoWire"


def _parse_timestamp(raw: str) -> datetime | None:
    """Parse RotoWire timestamp like 'February 26, 2026' into a timezone-aware datetime."""
    raw = raw.strip()
    if not raw:
        return None
    try:
        dt = datetime.strptime(raw, "%B %d, %Y")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        logger.warning("Could not parse timestamp: %r", raw)
        return None


def _normalize_team_abbr(raw: str) -> str | None:
    """Convert a RotoWire team abbreviation to our DB format."""
    raw = raw.strip().upper()
    return ROTOWIRE_TEAM_MAP.get(raw)


def _parse_single_item(item: Tag) -> ScrapedNewsItem | None:
    """Parse a single news-update div into a ScrapedNewsItem."""
    # Player name from the player link
    player_link = item.select_one("a.news-update__player-link")
    if not player_link:
        return None
    player_name = player_link.get_text(strip=True)
    if not player_name:
        return None

    # Team abbreviation from the team logo img alt attribute
    team_img = item.select_one("img.news-update__logo")
    team_abbr = None
    if team_img:
        raw_team = team_img.get("alt", "")
        team_abbr = _normalize_team_abbr(raw_team)

    # Headline and URL from the headline link
    headline_link = item.select_one("a.news-update__headline")
    if not headline_link:
        return None
    headline = headline_link.get_text(strip=True)
    if not headline:
        return None
    href = headline_link.get("href", "")
    if href and not href.startswith("http"):
        url = f"{ROTOWIRE_BASE_URL}{href}"
    else:
        url = href
    if not url:
        return None

    # Published date from the timestamp div
    timestamp_div = item.select_one("div.news-update__timestamp")
    published_at = None
    if timestamp_div:
        published_at = _parse_timestamp(timestamp_div.get_text(strip=True))
    if published_at is None:
        # Fallback to now if timestamp is missing/unparseable
        published_at = datetime.now(timezone.utc)

    # Body text from the news content div
    body_div = item.select_one("div.news-update__news")
    body = body_div.get_text(strip=True) if body_div else ""

    return ScrapedNewsItem(
        player_name=player_name,
        team_abbr=team_abbr,
        headline=headline,
        body=body,
        url=url,
        published_at=published_at,
    )


def parse_news_page(html: str) -> list[ScrapedNewsItem]:
    """
    Parse a RotoWire baseball news page into a list of ScrapedNewsItem objects.

    Pure function — no I/O. Skips items that are missing required fields
    (player name, headline, URL).
    """
    if not html or not html.strip():
        return []

    soup = BeautifulSoup(html, "html.parser")
    items = soup.select("div.news-update")

    results: list[ScrapedNewsItem] = []
    for item in items:
        try:
            parsed = _parse_single_item(item)
            if parsed:
                results.append(parsed)
        except Exception:
            logger.warning("Failed to parse news item", exc_info=True)
            continue

    return results
