"""Tests for the fetch_scoresheet_players script."""

from unittest.mock import MagicMock, patch

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import Player, PlayerPosition
from app.scripts.fetch_scoresheet_players import (
    build_tsv_url,
    fetch_tsv,
    import_from_tsv_text,
    main,
)

# Minimal valid TSV with two players (one hitter, one pitcher)
VALID_TSV = (
    "SSBB\tMLBAM\tNL\tpos\th\tage\tteam\tfirstName\tlastName"
    "\t1B\t2B\t3B\tSS\tOF\tosbAL\tocsAL\tosbNL\tocsNL"
    "\tBAvR\tOBvR\tSLvR\tBAvL\tOBvL\tSLvL\n"
    "100\t111111\t2001\tSS\tR\t25\tNYY\tJohn\tDoe"
    "\t\t\t\t4.50\t\t\t\t\t"
    "\t3\t8\t12\t-2\t-5\t-10\n"
    "200\t222222\t2002\tP\tL\t30\tBos\tJane\tSmith"
    "\t\t\t\t\t\t\t\t\t"
    "\t\t\t\t\t\t\n"
)

# TSV missing required columns
MALFORMED_TSV = "colA\tcolB\tcolC\n1\t2\t3\n"


# ---------------------------------------------------------------------------
# build_tsv_url
# ---------------------------------------------------------------------------


def test_build_tsv_url():
    """URL constructed from config settings."""
    url = build_tsv_url()
    assert url.startswith("https://www.scoresheet.com/")
    assert "BL_Players_" in url
    assert url.endswith(".tsv")


# ---------------------------------------------------------------------------
# fetch_tsv
# ---------------------------------------------------------------------------


def test_fetch_tsv_success():
    """HTTP download returns text body."""
    mock_response = MagicMock()
    mock_response.text = VALID_TSV
    mock_response.raise_for_status = MagicMock()

    with patch("app.scripts.fetch_scoresheet_players.httpx.Client") as MockClient:
        MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock())
        MockClient.return_value.__enter__.return_value.get.return_value = mock_response
        MockClient.return_value.__exit__ = MagicMock(return_value=False)

        result = fetch_tsv("https://example.com/test.tsv")
        assert result == VALID_TSV


def test_fetch_tsv_http_error():
    """4xx/5xx raises HTTPStatusError."""
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Not Found", request=MagicMock(), response=mock_response
    )

    with patch("app.scripts.fetch_scoresheet_players.httpx.Client") as MockClient:
        MockClient.return_value.__enter__ = MagicMock(return_value=MagicMock())
        MockClient.return_value.__enter__.return_value.get.return_value = mock_response
        MockClient.return_value.__exit__ = MagicMock(return_value=False)

        with pytest.raises(httpx.HTTPStatusError):
            fetch_tsv("https://example.com/test.tsv")


def test_fetch_tsv_network_error():
    """Connection failure raises RequestError."""
    with patch("app.scripts.fetch_scoresheet_players.httpx.Client") as MockClient:
        mock_client = MagicMock()
        mock_client.get.side_effect = httpx.ConnectError("Connection refused")
        MockClient.return_value.__enter__ = MagicMock(return_value=mock_client)
        MockClient.return_value.__exit__ = MagicMock(return_value=False)

        with pytest.raises(httpx.RequestError):
            fetch_tsv("https://example.com/test.tsv")


# ---------------------------------------------------------------------------
# import_from_tsv_text — exercises real parsing + DB logic
# ---------------------------------------------------------------------------


def test_import_from_tsv_text_success(sync_engine):
    """Valid TSV creates correct players + positions in DB."""
    Session = sessionmaker(sync_engine, expire_on_commit=False)

    import app.scripts.fetch_scoresheet_players as fetch_module

    original = fetch_module.SessionLocal
    fetch_module.SessionLocal = Session

    try:
        players, positions = import_from_tsv_text(VALID_TSV)

        assert players == 2
        assert positions == 1  # Only Doe has SS position

        with Session() as session:
            all_players = session.execute(select(Player)).scalars().all()
            assert len(all_players) == 2

            doe = session.execute(
                select(Player).where(Player.scoresheet_id == 100)
            ).scalar_one()
            assert doe.first_name == "John"
            assert doe.last_name == "Doe"
            assert doe.primary_position == "SS"
            assert doe.ba_vr == 3

            smith = session.execute(
                select(Player).where(Player.scoresheet_id == 200)
            ).scalar_one()
            assert smith.first_name == "Jane"
            assert smith.primary_position == "P"

            doe_positions = session.execute(
                select(PlayerPosition).where(PlayerPosition.player_id == doe.id)
            ).scalars().all()
            assert len(doe_positions) == 1
            assert doe_positions[0].position == "SS"
            assert float(doe_positions[0].rating) == 4.50
    finally:
        fetch_module.SessionLocal = original


def test_import_from_tsv_text_new_and_updated(sync_engine):
    """Re-import with changes creates new player and updates existing."""
    Session = sessionmaker(sync_engine, expire_on_commit=False)

    import app.scripts.fetch_scoresheet_players as fetch_module

    original = fetch_module.SessionLocal
    fetch_module.SessionLocal = Session

    try:
        import_from_tsv_text(VALID_TSV)

        # Second import: Doe gets a new team, new player added
        updated_tsv = (
            "SSBB\tMLBAM\tNL\tpos\th\tage\tteam\tfirstName\tlastName"
            "\t1B\t2B\t3B\tSS\tOF\tosbAL\tocsAL\tosbNL\tocsNL"
            "\tBAvR\tOBvR\tSLvR\tBAvL\tOBvL\tSLvL\n"
            "100\t111111\t2001\tSS\tR\t25\tLAD\tJohn\tDoe"
            "\t\t\t\t4.50\t\t\t\t\t"
            "\t3\t8\t12\t-2\t-5\t-10\n"
            "300\t333333\t3003\tOF\tL\t22\tSF\tNew\tPlayer"
            "\t\t\t\t\t3.00\t\t\t\t"
            "\t1\t2\t3\t-1\t-2\t-3\n"
        )
        players, positions = import_from_tsv_text(updated_tsv)

        assert players == 2

        with Session() as session:
            # 3 total: original Doe (updated), original Smith (from first import), new Player
            all_players = session.execute(select(Player)).scalars().all()
            assert len(all_players) == 3

            doe = session.execute(
                select(Player).where(Player.scoresheet_id == 100)
            ).scalar_one()
            assert doe.current_mlb_team == "LAD"

            new = session.execute(
                select(Player).where(Player.scoresheet_id == 300)
            ).scalar_one()
            assert new.first_name == "New"
            assert new.last_name == "Player"
    finally:
        fetch_module.SessionLocal = original


def test_import_from_tsv_text_malformed_columns(sync_engine):
    """Missing columns raises ValueError with no DB changes."""
    Session = sessionmaker(sync_engine, expire_on_commit=False)

    import app.scripts.fetch_scoresheet_players as fetch_module

    original = fetch_module.SessionLocal
    fetch_module.SessionLocal = Session

    try:
        with pytest.raises(ValueError, match="missing required columns"):
            import_from_tsv_text(MALFORMED_TSV)

        with Session() as session:
            count = session.execute(select(Player)).scalars().all()
            assert len(count) == 0
    finally:
        fetch_module.SessionLocal = original


def test_import_from_tsv_text_malformed_row(sync_engine):
    """Bad row data causes exception and full rollback."""
    Session = sessionmaker(sync_engine, expire_on_commit=False)

    import app.scripts.fetch_scoresheet_players as fetch_module

    original = fetch_module.SessionLocal
    fetch_module.SessionLocal = Session

    # First row is valid, second row has non-numeric SSBB
    bad_tsv = (
        "SSBB\tMLBAM\tNL\tpos\th\tage\tteam\tfirstName\tlastName"
        "\t1B\t2B\t3B\tSS\tOF\tosbAL\tocsAL\tosbNL\tocsNL"
        "\tBAvR\tOBvR\tSLvR\tBAvL\tOBvL\tSLvL\n"
        "100\t111111\t2001\tSS\tR\t25\tNYY\tGood\tRow"
        "\t\t\t\t\t\t\t\t\t"
        "\t\t\t\t\t\t\n"
        "BAD\tnotnum\t\tSS\tR\t25\tNYY\tBad\tRow"
        "\t\t\t\t\t\t\t\t\t"
        "\t\t\t\t\t\t\n"
    )

    try:
        with pytest.raises(Exception):
            import_from_tsv_text(bad_tsv)

        # Full rollback — no players should exist
        with Session() as session:
            count = session.execute(select(Player)).scalars().all()
            assert len(count) == 0
    finally:
        fetch_module.SessionLocal = original


# ---------------------------------------------------------------------------
# main() — integration with exit codes
# ---------------------------------------------------------------------------


def test_main_http_error_exits(caplog):
    """HTTP error exits with code 1 and logs warning."""
    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch(
        "app.scripts.fetch_scoresheet_players.fetch_tsv",
        side_effect=httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_response
        ),
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1


def test_main_network_error_exits(caplog):
    """Network error exits with code 1 and logs warning."""
    with patch(
        "app.scripts.fetch_scoresheet_players.fetch_tsv",
        side_effect=httpx.ConnectError("Connection refused"),
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1


def test_main_malformed_exits(caplog):
    """Bad TSV exits with code 1 and logs error."""
    with patch(
        "app.scripts.fetch_scoresheet_players.fetch_tsv",
        return_value=MALFORMED_TSV,
    ):
        with pytest.raises(SystemExit) as exc_info:
            main()
        assert exc_info.value.code == 1
