"""Tests for fetch_il_status script entry point."""

from unittest.mock import AsyncMock, patch

import pytest


class TestFetchILStatusScript:
    @pytest.mark.asyncio
    async def test_main_calls_service_and_logs_summary(
        self, db_session, make_mock_get_session, capsys,
    ):
        """main() calls fetch_and_persist_il_status and logs summary."""
        mock_summary = {
            "teams_fetched": 30,
            "teams_failed": 0,
            "il_players_found": 50,
            "scoresheet_matches": 12,
            "players_added_to_il": 12,
            "players_cleared_from_il": 3,
        }
        mock_service = AsyncMock(return_value=mock_summary)

        with (
            patch("app.scripts.fetch_il_status.get_session", make_mock_get_session()),
            patch(
                "app.scripts.fetch_il_status.fetch_and_persist_il_status",
                mock_service,
            ),
        ):
            from app.scripts.fetch_il_status import main

            await main()

        mock_service.assert_awaited_once_with(db_session)
        captured = capsys.readouterr()
        assert "IL status fetch summary" in captured.out
