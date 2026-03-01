"""Tests for RotoWire news parser."""

import pytest

from app.services.news_scraper.parser import (
    _strip_rotowire_attribution,
    parse_article_body,
    parse_news_page,
)


class TestStripRotowireAttribution:
    """Tests for _strip_rotowire_attribution helper."""

    def test_strips_prefix(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire Player was injured.")
            == "Player was injured."
        )

    def test_strips_prefix_with_dash(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire - Player was injured.")
            == "Player was injured."
        )

    def test_strips_prefix_with_em_dash(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire — Player was injured.")
            == "Player was injured."
        )

    def test_strips_prefix_with_period(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire. Player was injured.")
            == "Player was injured."
        )

    def test_strips_prefix_with_colon(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire: Player was injured.")
            == "Player was injured."
        )

    def test_strips_prefix_with_trailing_spaces(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire   Player was injured.")
            == "Player was injured."
        )

    def test_no_prefix_unchanged(self):
        text = "Player was placed on the IL."
        assert _strip_rotowire_attribution(text) == text

    def test_empty_string(self):
        assert _strip_rotowire_attribution("") == ""

    def test_case_insensitive(self):
        assert (
            _strip_rotowire_attribution("written by rotowire Player was injured.")
            == "Player was injured."
        )

    def test_prefix_not_at_start_unchanged(self):
        text = "According to sources, Written by RotoWire."
        assert _strip_rotowire_attribution(text) == text

    def test_prefix_only(self):
        assert _strip_rotowire_attribution("Written by RotoWire") == ""

    def test_prefix_with_only_whitespace_after(self):
        assert _strip_rotowire_attribution("Written by RotoWire   ") == ""

    def test_leading_whitespace_before_prefix(self):
        assert (
            _strip_rotowire_attribution(" Written by RotoWire Player was injured.")
            == "Player was injured."
        )

    def test_no_space_between_by_and_rotowire(self):
        assert (
            _strip_rotowire_attribution("Written byRotoWire Staff Player was injured.")
            == "Player was injured."
        )

    def test_staff_suffix(self):
        assert (
            _strip_rotowire_attribution("Written by RotoWire Staff Player was injured.")
            == "Player was injured."
        )

    def test_real_sample_body(self):
        sample = (
            " Written byRotoWire Staff Glasnow tossed two-plus innings"
            " against the White Sox in a Cactus League contest Thursday."
        )
        result = _strip_rotowire_attribution(sample)
        assert result.startswith("Glasnow tossed")
        assert "Written" not in result


class TestParseArticleBody:
    """Tests for parse_article_body including attribution stripping."""

    def test_strips_attribution_from_article(self):
        html = """
        <div class="gn-content">
            <p>Written by RotoWire Player hit a home run today.</p>
            <p>He now has 20 on the season.</p>
        </div>
        """
        result = parse_article_body(html)
        assert result == "Player hit a home run today.\nHe now has 20 on the season."

    def test_no_attribution_in_article(self):
        html = """
        <div class="gn-content">
            <p>Player hit a home run today.</p>
        </div>
        """
        result = parse_article_body(html)
        assert result == "Player hit a home run today."

    def test_empty_html(self):
        assert parse_article_body("") == ""

    def test_no_content_div(self):
        html = "<div class='other'>Some text</div>"
        assert parse_article_body(html) == ""


class TestParseNewsPageAttribution:
    """Tests that preview body in parse_news_page also strips the attribution."""

    def test_preview_body_stripped(self):
        html = """
        <div class="news-update">
            <a class="news-update__player-link">John Doe</a>
            <img class="news-update__logo" alt="NYY" />
            <a class="news-update__headline" href="/baseball/news/123">Headline text</a>
            <div class="news-update__timestamp">February 26, 2026</div>
            <div class="news-update__news">Written by RotoWire Player is day-to-day.</div>
        </div>
        """
        items = parse_news_page(html)
        assert len(items) == 1
        assert items[0].body == "Player is day-to-day."

    def test_preview_body_without_attribution_unchanged(self):
        html = """
        <div class="news-update">
            <a class="news-update__player-link">John Doe</a>
            <img class="news-update__logo" alt="NYY" />
            <a class="news-update__headline" href="/baseball/news/123">Headline text</a>
            <div class="news-update__timestamp">February 26, 2026</div>
            <div class="news-update__news">Player is day-to-day.</div>
        </div>
        """
        items = parse_news_page(html)
        assert len(items) == 1
        assert items[0].body == "Player is day-to-day."
