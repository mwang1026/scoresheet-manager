"""Tests for RotoWire news parser — pure functions, no I/O."""

import logging
from datetime import datetime, timezone

import pytest

from app.services.news_scraper.parser import (
    ROTOWIRE_BASE_URL,
    ROTOWIRE_TEAM_MAP,
    ScrapedNewsItem,
    _normalize_team_abbr,
    _parse_timestamp,
    parse_article_body,
    parse_news_page,
)


# ---------------------------------------------------------------------------
# HTML fixtures derived from real RotoWire response structure
# ---------------------------------------------------------------------------

SINGLE_ITEM_HTML = """
<html><body>
<div class="news-update">
 <div class="news-update__top">
  <img alt="DET" class="news-update__logo" src="https://content.rotowire.com/images/teamlogo/baseball/100DET.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/tarik-skubal-14872">
    Tarik Skubal
   </a>
   <a class="news-update__headline" href="/baseball/headlines/tarik-skubal-dominates-spring-991800" target="_blank">
    Dominates in spring start
   </a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">
   February 26, 2026
  </div>
  <div class="news-update__news">
   Skubal struck out seven in four innings during his spring debut Wednesday.
  </div>
 </div>
</div>
</body></html>
"""

MULTIPLE_ITEMS_HTML = """
<html><body>
<div class="news-update">
 <div class="news-update__top">
  <img alt="NYY" class="news-update__logo" src="logo.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/aaron-judge-12345">Aaron Judge</a>
   <a class="news-update__headline" href="/baseball/headlines/judge-homers-991801">Homers in exhibition</a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">February 25, 2026</div>
  <div class="news-update__news">Judge hit a two-run homer in Monday's Grapefruit League game.</div>
 </div>
</div>
<div class="news-update">
 <div class="news-update__top">
  <img alt="ATH" class="news-update__logo" src="logo.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/gunnar-hoglund-15452">Gunnar Hoglund</a>
   <a class="news-update__headline" href="/baseball/headlines/hoglund-injury-991797">Battling knee injury</a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">February 26, 2026</div>
  <div class="news-update__news">Hoglund is scheduled to see a doctor about a knee issue.</div>
 </div>
</div>
<div class="news-update">
 <div class="news-update__top">
  <img alt="CWS" class="news-update__logo" src="logo.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/garrett-crochet-14900">Garrett Crochet</a>
   <a class="news-update__headline" href="https://www.rotowire.com/baseball/headlines/crochet-update-991799">Expected back soon</a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">February 24, 2026</div>
  <div class="news-update__news">Crochet is expected to rejoin spring workouts this week.</div>
 </div>
</div>
</body></html>
"""

MISSING_FIELDS_HTML = """
<html><body>
<div class="news-update">
 <div class="news-update__top">
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/nobody-123"></a>
   <a class="news-update__headline" href="/baseball/headlines/test-991802">Some headline</a>
  </div>
 </div>
</div>
<div class="news-update">
 <div class="news-update__top">
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/real-456">Real Player</a>
  </div>
 </div>
</div>
<div class="news-update">
 <div class="news-update__top">
  <img alt="SF" class="news-update__logo" src="logo.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/baseball/player/valid-789">Valid Player</a>
   <a class="news-update__headline" href="/baseball/headlines/valid-991803">Valid headline</a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">January 15, 2026</div>
  <div class="news-update__news">Some body text here.</div>
 </div>
</div>
</body></html>
"""


# ---------------------------------------------------------------------------
# parse_news_page tests
# ---------------------------------------------------------------------------


class TestParseNewsPage:
    def test_single_item(self):
        """Parse a single well-formed news item."""
        items = parse_news_page(SINGLE_ITEM_HTML)
        assert len(items) == 1
        item = items[0]
        assert item.player_name == "Tarik Skubal"
        assert item.team_abbr == "Det"
        assert item.headline == "Dominates in spring start"
        assert "struck out seven" in item.body
        assert item.url == f"{ROTOWIRE_BASE_URL}/baseball/headlines/tarik-skubal-dominates-spring-991800"
        assert item.published_at == datetime(2026, 2, 26, tzinfo=timezone.utc)
        assert item.source == "RotoWire"

    def test_multiple_items(self):
        """Parse multiple news items."""
        items = parse_news_page(MULTIPLE_ITEMS_HTML)
        assert len(items) == 3

        # Verify all names parsed
        names = [i.player_name for i in items]
        assert "Aaron Judge" in names
        assert "Gunnar Hoglund" in names
        assert "Garrett Crochet" in names

    def test_team_mapping(self):
        """Team abbreviations are mapped correctly."""
        items = parse_news_page(MULTIPLE_ITEMS_HTML)
        team_map = {i.player_name: i.team_abbr for i in items}
        assert team_map["Aaron Judge"] == "NYA"  # NYY → NYA
        assert team_map["Gunnar Hoglund"] == "Ath"  # ATH → Ath
        assert team_map["Garrett Crochet"] == "ChA"  # CWS → ChA

    def test_relative_url_resolution(self):
        """Relative URLs are resolved to full RotoWire URLs."""
        items = parse_news_page(SINGLE_ITEM_HTML)
        assert items[0].url.startswith("https://www.rotowire.com/")

    def test_absolute_url_preserved(self):
        """Absolute URLs are kept as-is."""
        items = parse_news_page(MULTIPLE_ITEMS_HTML)
        crochet = next(i for i in items if i.player_name == "Garrett Crochet")
        assert crochet.url == "https://www.rotowire.com/baseball/headlines/crochet-update-991799"

    def test_empty_html(self):
        """Empty HTML returns empty list."""
        assert parse_news_page("") == []
        assert parse_news_page("   ") == []

    def test_no_news_items(self):
        """HTML without news-update divs returns empty list."""
        assert parse_news_page("<html><body><p>No news</p></body></html>") == []

    def test_missing_fields_handled_gracefully(self):
        """Items with missing required fields are skipped."""
        items = parse_news_page(MISSING_FIELDS_HTML)
        # First item: empty player name → skipped
        # Second item: no headline link → skipped
        # Third item: valid → kept
        assert len(items) == 1
        assert items[0].player_name == "Valid Player"
        assert items[0].team_abbr == "SF"

    def test_missing_team_logo(self):
        """Item without team logo gets team_abbr=None."""
        html = """
        <div class="news-update">
         <div class="news-update__top">
          <div class="news-update__playerhead">
           <a class="news-update__player-link" href="/p/1">John Smith</a>
           <a class="news-update__headline" href="/h/1">Some news</a>
          </div>
         </div>
         <div class="news-update__main">
          <div class="news-update__timestamp">March 1, 2026</div>
          <div class="news-update__news">Body text.</div>
         </div>
        </div>
        """
        items = parse_news_page(html)
        assert len(items) == 1
        assert items[0].team_abbr is None

    def test_missing_body(self):
        """Item without body div gets empty body string."""
        html = """
        <div class="news-update">
         <div class="news-update__top">
          <img alt="BAL" class="news-update__logo" src="logo.png"/>
          <div class="news-update__playerhead">
           <a class="news-update__player-link" href="/p/1">Adley Rutschman</a>
           <a class="news-update__headline" href="/h/1">Signs extension</a>
          </div>
         </div>
         <div class="news-update__main">
          <div class="news-update__timestamp">February 20, 2026</div>
         </div>
        </div>
        """
        items = parse_news_page(html)
        assert len(items) == 1
        assert items[0].body == ""


# ---------------------------------------------------------------------------
# _parse_timestamp tests
# ---------------------------------------------------------------------------


class TestParseTimestamp:
    def test_valid_date(self):
        assert _parse_timestamp("February 26, 2026") == datetime(2026, 2, 26, tzinfo=timezone.utc)

    def test_january(self):
        assert _parse_timestamp("January 1, 2026") == datetime(2026, 1, 1, tzinfo=timezone.utc)

    def test_december(self):
        assert _parse_timestamp("December 31, 2025") == datetime(2025, 12, 31, tzinfo=timezone.utc)

    def test_whitespace_stripped(self):
        assert _parse_timestamp("  March 15, 2026  ") == datetime(2026, 3, 15, tzinfo=timezone.utc)

    def test_empty_string(self):
        assert _parse_timestamp("") is None

    def test_invalid_format(self):
        assert _parse_timestamp("2026-02-26") is None

    def test_garbage(self):
        assert _parse_timestamp("not a date") is None

    def test_unparseable_timestamp_warns(self, caplog):
        """Unparseable timestamp emits a warning log."""
        with caplog.at_level(logging.WARNING, logger="app.services.news_scraper.parser"):
            result = _parse_timestamp("not-a-date")

        assert result is None
        assert any(
            "Could not parse timestamp" in r.message and "not-a-date" in r.message
            for r in caplog.records
        )


# ---------------------------------------------------------------------------
# _normalize_team_abbr tests
# ---------------------------------------------------------------------------


class TestNormalizeTeamAbbr:
    def test_standard_mapping(self):
        assert _normalize_team_abbr("DET") == "Det"
        assert _normalize_team_abbr("NYY") == "NYA"
        assert _normalize_team_abbr("NYM") == "NYN"

    def test_case_insensitive(self):
        assert _normalize_team_abbr("det") == "Det"
        assert _normalize_team_abbr("Det") == "Det"

    def test_chicago_teams(self):
        assert _normalize_team_abbr("CHC") == "ChN"
        assert _normalize_team_abbr("CHW") == "ChA"
        assert _normalize_team_abbr("CWS") == "ChA"

    def test_oakland_athletics(self):
        assert _normalize_team_abbr("ATH") == "Ath"
        assert _normalize_team_abbr("OAK") == "Ath"

    def test_tampa_bay(self):
        assert _normalize_team_abbr("TB") == "TB"
        assert _normalize_team_abbr("TBR") == "TB"

    def test_washington(self):
        assert _normalize_team_abbr("WAS") == "Was"
        assert _normalize_team_abbr("WSH") == "Was"

    def test_unknown_team(self):
        assert _normalize_team_abbr("XYZ") is None

    def test_all_30_teams_covered(self):
        """All 30 MLB teams have at least one mapping."""
        db_teams = {
            "Ari", "Ath", "Atl", "Bal", "Bos", "ChA", "ChN", "Cin", "Cle", "Col",
            "Det", "Hou", "KC", "LAA", "LAD", "Mia", "Mil", "Min", "NYA", "NYN",
            "Phi", "Pit", "SD", "Sea", "SF", "StL", "TB", "Tex", "Tor", "Was",
        }
        mapped_teams = set(ROTOWIRE_TEAM_MAP.values())
        assert db_teams == mapped_teams


# ---------------------------------------------------------------------------
# parse_article_body tests
# ---------------------------------------------------------------------------

# Fixture derived from real RotoWire article detail page structure
ARTICLE_PAGE_HTML = """
<html><body>
<div class="main-content">
  <h1>Skubal Dominates in Spring Start</h1>
  <div class="gn-content">
    <p>Tarik Skubal struck out seven batters over four innings in his spring debut Wednesday against the Phillies.</p>
    <p>The reigning AL Cy Young winner showed elite command, throwing 42 of 55 pitches for strikes.</p>
    <p>Skubal is expected to make two more spring starts before the regular season opener.</p>
  </div>
</div>
</body></html>
"""

ARTICLE_PAGE_NO_CONTENT_HTML = """
<html><body>
<div class="main-content">
  <h1>Some headline</h1>
  <p>Page without the expected gn-content div.</p>
</div>
</body></html>
"""


class TestParseArticleBody:
    def test_extracts_paragraphs(self):
        """Full article text is extracted from div.gn-content paragraphs."""
        body = parse_article_body(ARTICLE_PAGE_HTML)
        assert "struck out seven batters" in body
        assert "elite command" in body
        assert "two more spring starts" in body

    def test_paragraphs_joined_with_newlines(self):
        """Multiple paragraphs are joined with newline separators."""
        body = parse_article_body(ARTICLE_PAGE_HTML)
        lines = body.split("\n")
        assert len(lines) == 3

    def test_missing_gn_content_returns_empty(self):
        """Returns empty string when div.gn-content is not found."""
        body = parse_article_body(ARTICLE_PAGE_NO_CONTENT_HTML)
        assert body == ""

    def test_empty_html_returns_empty(self):
        """Returns empty string for empty/whitespace input."""
        assert parse_article_body("") == ""
        assert parse_article_body("   ") == ""

    def test_empty_paragraphs_skipped(self):
        """Empty <p> tags are excluded from the result."""
        html = """
        <div class="gn-content">
          <p>First paragraph.</p>
          <p></p>
          <p>  </p>
          <p>Third paragraph.</p>
        </div>
        """
        body = parse_article_body(html)
        lines = body.split("\n")
        assert len(lines) == 2
        assert lines[0] == "First paragraph."
        assert lines[1] == "Third paragraph."
