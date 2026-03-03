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

from app.services.name_matching import ROTOWIRE_TEAM_MAP  # noqa: F401 — re-export

logger = logging.getLogger(__name__)

ROTOWIRE_BASE_URL = "https://www.rotowire.com"

_ROTOWIRE_ATTRIBUTION_RE = re.compile(
    r"^\s*Written\s+by\s*RotoWire(?:\s+Staff)?[\s.\-—–:]*",
    flags=re.IGNORECASE,
)


def _strip_rotowire_attribution(text: str) -> str:
    """Remove the 'Written by RotoWire' prefix and any trailing punctuation/whitespace."""
    return _ROTOWIRE_ATTRIBUTION_RE.sub("", text)


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
    body = _strip_rotowire_attribution(body)

    return ScrapedNewsItem(
        player_name=player_name,
        team_abbr=team_abbr,
        headline=headline,
        body=body,
        url=url,
        published_at=published_at,
    )


def parse_article_body(html: str) -> str:
    """
    Extract full article text from an individual RotoWire article page.

    Looks for ``div.gn-content`` and joins all paragraph text with newlines.
    Returns empty string if the element is not found or HTML is empty.
    """
    if not html or not html.strip():
        return ""

    soup = BeautifulSoup(html, "html.parser")
    content_div = soup.select_one("div.gn-content")
    if not content_div:
        return ""

    paragraphs = [p.get_text(strip=True) for p in content_div.find_all("p")]
    body = "\n".join(p for p in paragraphs if p)
    return _strip_rotowire_attribution(body)


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
