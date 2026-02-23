"""
Tests for the Scoresheet scraper service.

All tests use inline HTML/JS strings or httpx.MockTransport -- no network calls.
"""

import pytest
import httpx

from app.services.scoresheet_scraper import (
    ScrapedLeague,
    ScrapedTeam,
    _league_cache,
    fetch_league_list,
    fetch_league_teams,
    get_cached_leagues,
    parse_league_js,
    parse_league_list_html,
    refresh_league_cache,
)
import app.services.scoresheet_scraper as scraper_module


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

TYPICAL_LEAGUE_LIST_HTML = """
<html><body>
  <a href="../FOR_WWW/AL_Catfish_Hunter.htm">AL Catfish Hunter</a>
  <a href="../FOR_WWW/NL_Hank_Aaron.htm">NL Hank Aaron</a>
  <a href="../CWWW/Central_Bob_Gibson.htm">Central Bob Gibson</a>
  <a href="/some/other/link">Not a league</a>
  <a href="../UNKNOWN_DIR/SomeLeague.htm">Should be skipped</a>
</body></html>
"""

TYPICAL_JS_CONTENT = """
var leagueData = {
  owner : ["Alice Smith", "Bob Jones", "Carol White", "Dave Brown", "Eve Davis",
           "Frank Wilson", "Grace Lee", "Henry Taylor", "Irene Martin", "Jack Clark"],
  other_field: "ignored"
};
"""

SINGLE_QUOTED_JS_CONTENT = """
var leagueData = {
  owner : ['Alice Smith', 'Bob Jones', 'Carol White', 'Dave Brown', 'Eve Davis',
           'Frank Wilson', 'Grace Lee', 'Henry Taylor', 'Irene Martin', 'Jack Clark'],
};
"""


# ---------------------------------------------------------------------------
# TestParseLeagueListHtml
# ---------------------------------------------------------------------------


class TestParseLeagueListHtml:
    def test_typical_leagues(self):
        """Parses known-good league links and maps FOR_WWW -> FOR_WWW1."""
        leagues = parse_league_list_html(TYPICAL_LEAGUE_LIST_HTML)

        # Should find 3 leagues (UNKNOWN_DIR skipped, non-league link skipped)
        assert len(leagues) == 3

        names = [lg.name for lg in leagues]
        paths = [lg.data_path for lg in leagues]

        assert "AL Catfish Hunter" in names
        assert "NL Hank Aaron" in names
        assert "Central Bob Gibson" in names

    def test_for_www_to_for_www1_mapping(self):
        """FOR_WWW in href maps to FOR_WWW1 in data_path."""
        leagues = parse_league_list_html(TYPICAL_LEAGUE_LIST_HTML)
        catfish = next(lg for lg in leagues if "Catfish" in lg.name)
        assert catfish.data_path == "FOR_WWW1/AL_Catfish_Hunter"

    def test_cwww_direct_mapping(self):
        """CWWW in href stays as CWWW in data_path."""
        leagues = parse_league_list_html(TYPICAL_LEAGUE_LIST_HTML)
        gibson = next(lg for lg in leagues if "Gibson" in lg.name)
        assert gibson.data_path == "CWWW/Central_Bob_Gibson"

    def test_unknown_directory_skipped(self):
        """Links with unknown directories are not included."""
        leagues = parse_league_list_html(TYPICAL_LEAGUE_LIST_HTML)
        paths = [lg.data_path for lg in leagues]
        assert not any("UNKNOWN_DIR" in p for p in paths)

    def test_non_league_links_ignored(self):
        """Links not matching ../DIR/SLUG.htm pattern are ignored."""
        leagues = parse_league_list_html(TYPICAL_LEAGUE_LIST_HTML)
        # /some/other/link should not appear
        assert len(leagues) == 3

    def test_sorted_by_name(self):
        """Result is sorted alphabetically by name."""
        leagues = parse_league_list_html(TYPICAL_LEAGUE_LIST_HTML)
        names = [lg.name for lg in leagues]
        assert names == sorted(names)

    def test_empty_html(self):
        """Empty HTML returns empty list."""
        result = parse_league_list_html("")
        assert result == []

    def test_html_with_no_league_links(self):
        """HTML with no matching links returns empty list."""
        html = "<html><body><a href='/foo'>bar</a></body></html>"
        result = parse_league_list_html(html)
        assert result == []


# ---------------------------------------------------------------------------
# TestParseLeagueJs
# ---------------------------------------------------------------------------


class TestParseLeagueJs:
    def test_ten_team_file(self):
        """Parses a standard 10-owner JS file correctly."""
        teams = parse_league_js(TYPICAL_JS_CONTENT)
        assert len(teams) == 10

    def test_one_indexed_ids(self):
        """scoresheet_id is 1-indexed (first owner gets ID 1)."""
        teams = parse_league_js(TYPICAL_JS_CONTENT)
        ids = [t.scoresheet_id for t in teams]
        assert ids == list(range(1, 11))

    def test_owner_names_correct(self):
        """Owner names are extracted correctly."""
        teams = parse_league_js(TYPICAL_JS_CONTENT)
        assert teams[0].owner_name == "Alice Smith"
        assert teams[9].owner_name == "Jack Clark"

    def test_single_quoted_names(self):
        """Falls back to single-quoted strings if no double quotes."""
        teams = parse_league_js(SINGLE_QUOTED_JS_CONTENT)
        assert len(teams) == 10
        assert teams[0].owner_name == "Alice Smith"

    def test_missing_owner_array_raises(self):
        """Missing owner array raises ValueError."""
        with pytest.raises(ValueError, match="No 'owner' array"):
            parse_league_js("var x = { foo: ['a', 'b'] };")

    def test_empty_js_raises(self):
        """Empty JS raises ValueError."""
        with pytest.raises(ValueError):
            parse_league_js("")

    def test_too_many_owners_raises(self):
        """More than 20 owners raises ValueError."""
        names = ", ".join(f'"Owner {i}"' for i in range(25))
        js = f"var x = {{ owner : [{names}] }};"
        with pytest.raises(ValueError, match="max 20"):
            parse_league_js(js)

    def test_whitespace_stripping(self):
        """Whitespace is stripped from owner names."""
        js = 'var x = { owner : ["  Alice  ", "  Bob  "] };'
        teams = parse_league_js(js)
        assert teams[0].owner_name == "Alice"
        assert teams[1].owner_name == "Bob"

    def test_empty_name_defaults_to_team_n(self):
        """Empty names are replaced with 'Team #N'."""
        js = 'var x = { owner : ["Alice", "", "Carol"] };'
        teams = parse_league_js(js)
        assert teams[1].owner_name == "Team #2"

    def test_name_truncated_at_100_chars(self):
        """Names longer than 100 chars are truncated."""
        long_name = "A" * 150
        js = f'var x = {{ owner : ["{long_name}"] }};'
        teams = parse_league_js(js)
        assert len(teams[0].owner_name) == 100

    def test_malicious_js_safely_ignored(self):
        """eval/exec style content doesn't get executed -- just parsed."""
        malicious_js = """
        var x = {
            owner : ["'; DROP TABLE leagues; --", "eval(alert(1))"],
        };
        """
        # Should not raise, just return the literal strings
        teams = parse_league_js(malicious_js)
        assert len(teams) == 2
        assert teams[0].owner_name == "'; DROP TABLE leagues; --"

    def test_special_chars_in_names(self):
        """Special characters in names are preserved."""
        js = 'var x = { owner : ["O\'Brien", "García", "St. Claire"] };'
        # Double-quoted search won't find single-quoted O'Brien content
        # But García and St. Claire are double-quoted
        teams = parse_league_js(js)
        assert any("Garc" in t.owner_name for t in teams)


# ---------------------------------------------------------------------------
# TestDataPathValidation
# ---------------------------------------------------------------------------


class TestDataPathValidation:
    """Tests for data_path validation in fetch_league_teams."""

    @pytest.mark.asyncio
    async def test_valid_path_accepted(self):
        """Valid data_path passes validation and makes HTTP request."""
        # Use mock transport to avoid real network call
        mock_js = TYPICAL_JS_CONTENT

        def handler(request):
            return httpx.Response(200, text=mock_js)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            teams = await fetch_league_teams(client, "FOR_WWW1/AL_Catfish_Hunter")
        assert len(teams) == 10

    @pytest.mark.asyncio
    async def test_path_traversal_rejected(self):
        """Path traversal attempts are rejected with ValueError."""
        transport = httpx.MockTransport(lambda r: httpx.Response(200, text=""))
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(ValueError, match="Invalid data_path"):
                await fetch_league_teams(client, "../etc/passwd")

    @pytest.mark.asyncio
    async def test_path_with_slashes_rejected(self):
        """Paths with multiple slashes are rejected."""
        transport = httpx.MockTransport(lambda r: httpx.Response(200, text=""))
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(ValueError, match="Invalid data_path"):
                await fetch_league_teams(client, "FOR_WWW1/a/b")

    @pytest.mark.asyncio
    async def test_empty_path_rejected(self):
        """Empty data_path is rejected."""
        transport = httpx.MockTransport(lambda r: httpx.Response(200, text=""))
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(ValueError, match="Invalid data_path"):
                await fetch_league_teams(client, "")

    @pytest.mark.asyncio
    async def test_path_with_special_chars_rejected(self):
        """Paths with special characters are rejected."""
        transport = httpx.MockTransport(lambda r: httpx.Response(200, text=""))
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(ValueError, match="Invalid data_path"):
                await fetch_league_teams(client, "FOR_WWW1/league?foo=bar")


# ---------------------------------------------------------------------------
# TestFetchFunctions
# ---------------------------------------------------------------------------


class TestFetchFunctions:
    """Tests for async fetch functions using httpx.MockTransport."""

    @pytest.mark.asyncio
    async def test_fetch_league_list(self):
        """fetch_league_list fetches the league list URL and parses it."""
        def handler(request):
            assert "BB_LeagueList.php" in str(request.url)
            return httpx.Response(200, text=TYPICAL_LEAGUE_LIST_HTML)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            leagues = await fetch_league_list(client)

        assert len(leagues) == 3

    @pytest.mark.asyncio
    async def test_fetch_league_list_http_error(self):
        """fetch_league_list propagates HTTP errors."""
        def handler(request):
            return httpx.Response(503)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(httpx.HTTPStatusError):
                await fetch_league_list(client)

    @pytest.mark.asyncio
    async def test_fetch_league_teams_builds_correct_url(self):
        """fetch_league_teams builds the correct JS URL."""
        captured_urls = []

        def handler(request):
            captured_urls.append(str(request.url))
            return httpx.Response(200, text=TYPICAL_JS_CONTENT)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            await fetch_league_teams(client, "FOR_WWW1/AL_Catfish_Hunter")

        assert len(captured_urls) == 1
        assert captured_urls[0].endswith("FOR_WWW1/AL_Catfish_Hunter.js")

    @pytest.mark.asyncio
    async def test_fetch_league_teams_http_error(self):
        """fetch_league_teams propagates HTTP errors."""
        def handler(request):
            return httpx.Response(404)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            with pytest.raises(httpx.HTTPStatusError):
                await fetch_league_teams(client, "FOR_WWW1/AL_Catfish_Hunter")


# ---------------------------------------------------------------------------
# TestLeagueCache
# ---------------------------------------------------------------------------


class TestLeagueCache:
    """Tests for the in-memory league cache."""

    @pytest.mark.asyncio
    async def test_refresh_populates_cache(self, monkeypatch):
        """refresh_league_cache fetches leagues and populates the cache."""
        expected = [
            ScrapedLeague(name="League A", data_path="FOR_WWW1/League_A"),
            ScrapedLeague(name="League B", data_path="FOR_WWW1/League_B"),
        ]

        async def mock_refresh():
            scraper_module._league_cache = expected
            return expected

        monkeypatch.setattr(scraper_module, "_league_cache", [])

        def handler(request):
            html = """
            <html><body>
              <a href="../FOR_WWW/League_A.htm">League A</a>
              <a href="../FOR_WWW/League_B.htm">League B</a>
            </body></html>
            """
            return httpx.Response(200, text=html)

        # Patch httpx.AsyncClient to use mock transport
        original_client = httpx.AsyncClient

        class MockAsyncClient:
            def __init__(self, *args, **kwargs):
                self._transport = httpx.MockTransport(handler)
                self._client = original_client(transport=self._transport)

            async def __aenter__(self):
                return self._client

            async def __aexit__(self, *args):
                await self._client.aclose()

        monkeypatch.setattr(httpx, "AsyncClient", MockAsyncClient)

        result = await refresh_league_cache()

        assert len(result) == 2
        assert scraper_module._league_cache == result

    def test_get_cached_leagues_returns_cache(self, monkeypatch):
        """get_cached_leagues returns the current cache without I/O."""
        expected = [ScrapedLeague(name="Test", data_path="FOR_WWW1/Test")]
        monkeypatch.setattr(scraper_module, "_league_cache", expected)
        result = get_cached_leagues()
        assert result == expected

    def test_get_cached_leagues_empty_initially(self, monkeypatch):
        """Cache is empty before first refresh."""
        monkeypatch.setattr(scraper_module, "_league_cache", [])
        result = get_cached_leagues()
        assert result == []
