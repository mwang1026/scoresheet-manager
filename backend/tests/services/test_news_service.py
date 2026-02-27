"""Tests for news scraper service — mock HTTP, exercise real parsing/matching."""

from unittest.mock import patch

import httpx
import pytest
from sqlalchemy import select

from app.models.player import Player
from app.models.player_news import PlayerNews
from app.services.news_scraper.service import scrape_and_persist_news


# ---------------------------------------------------------------------------
# Mock HTTP helpers
# ---------------------------------------------------------------------------


class RoutingMockHttpClient:
    """
    Mock httpx client that routes responses by URL substring.

    Both the service (fetching news HTML) and the matcher (MLB API search)
    use httpx.AsyncClient. Since they share the same global import, we need
    a single mock that handles both request types.
    """

    def __init__(self, news_html="", mlb_api_json=None, error=None,
                 article_html=None, article_error=None):
        self._news_html = news_html
        self._mlb_api_json = mlb_api_json or {"people": []}
        self._error = error
        self._article_html = article_html
        self._article_error = article_error

    async def get(self, url, *args, **kwargs):
        if self._error:
            raise self._error
        url_str = str(url)
        if "statsapi.mlb.com" in url_str:
            return httpx.Response(
                200,
                json=self._mlb_api_json,
                request=httpx.Request("GET", url_str),
            )
        # Article detail pages (not the news list page)
        if "news.php" not in url_str and self._article_html is not None:
            if self._article_error:
                raise self._article_error
            return httpx.Response(
                200,
                text=self._article_html,
                request=httpx.Request("GET", url_str),
            )
        if "news.php" not in url_str and self._article_error:
            raise self._article_error
        return httpx.Response(
            200,
            text=self._news_html,
            request=httpx.Request("GET", url_str),
        )


class _MockAsyncClientClass:
    """Replaces httpx.AsyncClient as a class that creates RoutingMockHttpClient."""

    def __init__(self, client):
        self._client = client

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self._client

    async def __aexit__(self, *args):
        pass


# ---------------------------------------------------------------------------
# HTML fixture for service tests (realistic RotoWire structure)
# ---------------------------------------------------------------------------

MOCK_NEWS_HTML = """
<html><body>
<div class="news-update">
 <div class="news-update__top">
  <img alt="LAA" class="news-update__logo" src="logo.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/p/1">Mike Trout</a>
   <a class="news-update__headline" href="/h/trout-1">Returns to lineup</a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">February 26, 2026</div>
  <div class="news-update__news">Trout is back in the starting lineup for Wednesday's game.</div>
 </div>
</div>
<div class="news-update">
 <div class="news-update__top">
  <img alt="NYY" class="news-update__logo" src="logo.png"/>
  <div class="news-update__playerhead">
   <a class="news-update__player-link" href="/p/2">Aaron Judge</a>
   <a class="news-update__headline" href="/h/judge-1">Hits two homers</a>
  </div>
 </div>
 <div class="news-update__main">
  <div class="news-update__timestamp">February 25, 2026</div>
  <div class="news-update__news">Judge homered twice in the exhibition game.</div>
 </div>
</div>
</body></html>
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_player(db_session, first_name, last_name, team, scoresheet_id, mlb_id):
    p = Player(
        first_name=first_name,
        last_name=last_name,
        current_mlb_team=team,
        scoresheet_id=scoresheet_id,
        mlb_id=mlb_id,
        primary_position="OF",
        is_trade_bait=False,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


def _patch_httpx(mock_client):
    """Patch httpx.AsyncClient globally (service + matcher share the same import)."""
    fake_cls = _MockAsyncClientClass(mock_client)
    return patch("httpx.AsyncClient", fake_cls)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestScrapeAndPersistNews:
    @pytest.mark.asyncio
    async def test_scrape_and_persist(self, db_session):
        """Full flow: fetch, parse, match, persist."""
        p1 = await _create_player(db_session, "Mike", "Trout", "LAA", 100, 545361)
        p2 = await _create_player(db_session, "Aaron", "Judge", "NYA", 101, 592450)

        mock = RoutingMockHttpClient(news_html=MOCK_NEWS_HTML)
        with _patch_httpx(mock):
            summary = await scrape_and_persist_news(db_session)

        assert summary["fetched"] == 2
        assert summary["new"] == 2
        assert summary["skipped"] == 0
        assert summary["matched"] == 2
        assert summary["unmatched"] == 0

        result = await db_session.execute(
            select(PlayerNews).order_by(PlayerNews.published_at.desc())
        )
        rows = result.scalars().all()
        assert len(rows) == 2

    @pytest.mark.asyncio
    async def test_dedup_second_run(self, db_session):
        """Running twice with same data produces 0 new rows on second run."""
        await _create_player(db_session, "Mike", "Trout", "LAA", 100, 545361)
        await _create_player(db_session, "Aaron", "Judge", "NYA", 101, 592450)

        mock = RoutingMockHttpClient(news_html=MOCK_NEWS_HTML)
        with _patch_httpx(mock):
            summary1 = await scrape_and_persist_news(db_session)
            assert summary1["new"] == 2

            summary2 = await scrape_and_persist_news(db_session)
            assert summary2["fetched"] == 2
            assert summary2["new"] == 0
            assert summary2["skipped"] == 2

        result = await db_session.execute(select(PlayerNews))
        assert len(result.scalars().all()) == 2

    @pytest.mark.asyncio
    async def test_http_error_graceful(self, db_session):
        """HTTP error returns empty summary, no crash."""
        mock = RoutingMockHttpClient(
            error=httpx.HTTPStatusError(
                "500",
                request=httpx.Request("GET", "http://test"),
                response=httpx.Response(500),
            )
        )
        with _patch_httpx(mock):
            summary = await scrape_and_persist_news(db_session)

        assert summary["fetched"] == 0
        assert summary["new"] == 0

    @pytest.mark.asyncio
    async def test_request_error_graceful(self, db_session):
        """Network error returns empty summary."""
        mock = RoutingMockHttpClient(error=httpx.ConnectError("Connection refused"))
        with _patch_httpx(mock):
            summary = await scrape_and_persist_news(db_session)

        assert summary["fetched"] == 0

    @pytest.mark.asyncio
    async def test_empty_page(self, db_session):
        """Page with no news items returns empty summary."""
        mock = RoutingMockHttpClient(news_html="<html><body></body></html>")
        with _patch_httpx(mock):
            summary = await scrape_and_persist_news(db_session)

        assert summary["fetched"] == 0
        assert summary["new"] == 0

    @pytest.mark.asyncio
    async def test_unmatched_player_persisted(self, db_session):
        """Unmatched players are still persisted with player_id=None."""
        mock = RoutingMockHttpClient(news_html=MOCK_NEWS_HTML)
        with _patch_httpx(mock):
            summary = await scrape_and_persist_news(db_session)

        assert summary["unmatched"] == 2
        assert summary["new"] == 2

        result = await db_session.execute(select(PlayerNews))
        rows = result.scalars().all()
        assert len(rows) == 2
        for row in rows:
            assert row.player_id is None
            assert row.match_method == "unmatched"
            assert row.raw_player_name is not None


# ---------------------------------------------------------------------------
# Article body fetching tests
# ---------------------------------------------------------------------------

MOCK_ARTICLE_HTML = """
<html><body>
<div class="gn-content">
  <p>Trout returned to the lineup after missing two weeks with a calf strain.</p>
  <p>He went 2-for-4 with a double and a walk in his return game.</p>
</div>
</body></html>
"""


class TestArticleBodyFetching:
    @pytest.mark.asyncio
    async def test_full_body_replaces_preview(self, db_session):
        """Article detail body replaces the preview snippet from the list page."""
        await _create_player(db_session, "Mike", "Trout", "LAA", 100, 545361)
        await _create_player(db_session, "Aaron", "Judge", "NYA", 101, 592450)

        mock = RoutingMockHttpClient(
            news_html=MOCK_NEWS_HTML,
            article_html=MOCK_ARTICLE_HTML,
        )
        with _patch_httpx(mock):
            await scrape_and_persist_news(db_session)

        result = await db_session.execute(
            select(PlayerNews).order_by(PlayerNews.published_at.desc())
        )
        rows = result.scalars().all()
        # Both items should have the full article body (not the preview)
        for row in rows:
            assert "calf strain" in row.body
            assert "2-for-4" in row.body

    @pytest.mark.asyncio
    async def test_article_fetch_failure_keeps_preview(self, db_session):
        """On article fetch failure, the preview body is preserved."""
        await _create_player(db_session, "Mike", "Trout", "LAA", 100, 545361)
        await _create_player(db_session, "Aaron", "Judge", "NYA", 101, 592450)

        mock = RoutingMockHttpClient(
            news_html=MOCK_NEWS_HTML,
            article_error=httpx.ConnectError("Connection refused"),
        )
        with _patch_httpx(mock):
            await scrape_and_persist_news(db_session)

        result = await db_session.execute(
            select(PlayerNews).order_by(PlayerNews.published_at.desc())
        )
        rows = result.scalars().all()
        assert len(rows) == 2
        # Preview bodies should be preserved as fallback
        bodies = {row.body for row in rows}
        assert any("back in the starting lineup" in b for b in bodies)
        assert any("homered twice" in b for b in bodies)

    @pytest.mark.asyncio
    async def test_empty_article_body_keeps_preview(self, db_session):
        """If article page has no gn-content, preview body is kept."""
        await _create_player(db_session, "Mike", "Trout", "LAA", 100, 545361)
        await _create_player(db_session, "Aaron", "Judge", "NYA", 101, 592450)

        mock = RoutingMockHttpClient(
            news_html=MOCK_NEWS_HTML,
            article_html="<html><body><p>No gn-content here</p></body></html>",
        )
        with _patch_httpx(mock):
            await scrape_and_persist_news(db_session)

        result = await db_session.execute(
            select(PlayerNews).order_by(PlayerNews.published_at.desc())
        )
        rows = result.scalars().all()
        bodies = {row.body for row in rows}
        assert any("back in the starting lineup" in b for b in bodies)
        assert any("homered twice" in b for b in bodies)
