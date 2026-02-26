"""Tests for scrape_scoresheet CLI script."""

from unittest.mock import AsyncMock, patch

import pytest

from app.scripts.scrape_scoresheet import cmd_leagues, cmd_teams
from app.services.scoresheet_scraper import ScrapedLeague, ScrapedTeam


class TestCmdLeagues:
    """Tests for cmd_leagues command."""

    @pytest.mark.asyncio
    async def test_fetches_and_logs_leagues(self):
        """cmd_leagues calls fetch_league_list and outputs results."""
        mock_leagues = [
            ScrapedLeague(name="AL Test League", data_path="FOR_WWW1/AL_Test"),
            ScrapedLeague(name="NL Other League", data_path="FOR_WWW1/NL_Other"),
        ]

        with patch(
            "app.scripts.scrape_scoresheet.fetch_league_list",
            new_callable=AsyncMock,
            return_value=mock_leagues,
        ) as mock_fetch:
            await cmd_leagues()

        mock_fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_handles_empty_league_list(self):
        """cmd_leagues handles no leagues gracefully."""
        with patch(
            "app.scripts.scrape_scoresheet.fetch_league_list",
            new_callable=AsyncMock,
            return_value=[],
        ):
            await cmd_leagues()


class TestCmdTeams:
    """Tests for cmd_teams command."""

    @pytest.mark.asyncio
    async def test_fetches_and_logs_teams(self):
        """cmd_teams calls fetch_league_teams with correct data_path."""
        mock_teams = [
            ScrapedTeam(scoresheet_id=1, owner_name="Alice"),
            ScrapedTeam(scoresheet_id=2, owner_name="Bob"),
        ]

        with patch(
            "app.scripts.scrape_scoresheet.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=mock_teams,
        ) as mock_fetch:
            await cmd_teams("FOR_WWW1/AL_Test")

        mock_fetch.assert_called_once()
        # Verify the data_path argument was passed through
        call_args = mock_fetch.call_args
        assert call_args[0][1] == "FOR_WWW1/AL_Test"

    @pytest.mark.asyncio
    async def test_handles_empty_team_list(self):
        """cmd_teams handles no teams gracefully."""
        with patch(
            "app.scripts.scrape_scoresheet.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=[],
        ):
            await cmd_teams("FOR_WWW1/Empty_League")
