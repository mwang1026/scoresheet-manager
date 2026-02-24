"""Tests for /api/players endpoints."""

import pytest

from app.models import League, Player, PlayerPosition, PlayerRoster, Team


@pytest.mark.asyncio
async def test_list_players_empty(client):
    """Test listing players when database is empty."""
    response = await client.get("/api/players")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 0
    assert data["players"] == []
    assert data["page"] == 1
    assert data["total_pages"] == 1


@pytest.mark.asyncio
async def test_list_players_filters_scoresheet_only(client, db_session, sample_player_data, sample_pecota_player_data):
    """Test that /api/players only returns Scoresheet players (not PECOTA-only)."""
    # Add Scoresheet player
    scoresheet_player = Player(**sample_player_data)
    db_session.add(scoresheet_player)

    # Add PECOTA-only player (no scoresheet_id)
    pecota_player = Player(**sample_pecota_player_data)
    db_session.add(pecota_player)

    await db_session.commit()

    # Query API
    response = await client.get("/api/players")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 1  # Only Scoresheet player
    assert len(data["players"]) == 1
    assert data["players"][0]["scoresheet_id"] == 100
    assert data["players"][0]["first_name"] == "Test"


@pytest.mark.asyncio
async def test_list_players_pagination(client, db_session):
    """Test pagination of player list."""
    # Create 25 Scoresheet players
    for i in range(25):
        player = Player(
            first_name=f"Player",
            last_name=f"Test{i:02d}",
            scoresheet_id=1000 + i,
            primary_position="SS",
            is_trade_bait=False,
        )
        db_session.add(player)
    await db_session.commit()

    # Page 1
    response = await client.get("/api/players?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 25
    assert len(data["players"]) == 10
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert data["total_pages"] == 3

    # Page 2
    response = await client.get("/api/players?page=2&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["players"]) == 10
    assert data["page"] == 2

    # Page 3 (partial)
    response = await client.get("/api/players?page=3&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["players"]) == 5
    assert data["page"] == 3


@pytest.mark.asyncio
async def test_list_players_filter_by_position(client, db_session):
    """Test filtering players by position."""
    # Create players with different positions
    ss_player = Player(
        first_name="SS",
        last_name="Player",
        scoresheet_id=1001,
        primary_position="SS",
        is_trade_bait=False,
    )
    of_player = Player(
        first_name="OF",
        last_name="Player",
        scoresheet_id=1002,
        primary_position="OF",
        is_trade_bait=False,
    )
    p_player = Player(
        first_name="P",
        last_name="Player",
        scoresheet_id=1003,
        primary_position="P",
        is_trade_bait=False,
    )
    db_session.add_all([ss_player, of_player, p_player])
    await db_session.commit()

    # Filter by SS
    response = await client.get("/api/players?position=SS")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["players"][0]["primary_position"] == "SS"


@pytest.mark.asyncio
async def test_list_players_filter_by_team(client, db_session):
    """Test filtering players by team."""
    nyy_player = Player(
        first_name="Aaron",
        last_name="Judge",
        scoresheet_id=2001,
        primary_position="OF",
        current_mlb_team="NYY",
        is_trade_bait=False,
    )
    lad_player = Player(
        first_name="Shohei",
        last_name="Ohtani",
        scoresheet_id=2002,
        primary_position="DH",
        current_mlb_team="LAD",
        is_trade_bait=False,
    )
    db_session.add_all([nyy_player, lad_player])
    await db_session.commit()

    # Filter by NYY
    response = await client.get("/api/players?team=NYY")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["players"][0]["current_mlb_team"] == "NYY"


@pytest.mark.asyncio
async def test_get_player_detail(client, db_session, sample_player_data):
    """Test getting detailed player information."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add defensive position
    position = PlayerPosition(player_id=player.id, position="SS", rating=4.80)
    db_session.add(position)
    await db_session.commit()

    # Get player detail
    response = await client.get(f"/api/players/{player.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == player.id
    assert data["first_name"] == "Test"
    assert data["last_name"] == "Player"
    assert data["scoresheet_id"] == 100
    assert data["mlb_id"] == 999999
    assert data["primary_position"] == "SS"
    assert len(data["positions"]) == 1
    assert data["positions"][0]["position"] == "SS"
    assert data["positions"][0]["rating"] == 4.80


@pytest.mark.asyncio
async def test_get_player_detail_with_splits(client, db_session):
    """Test getting player with batting split adjustments."""
    player = Player(
        first_name="Test",
        last_name="Hitter",
        scoresheet_id=3001,
        primary_position="SS",
        is_trade_bait=False,
        ba_vr=5,
        ob_vr=10,
        sl_vr=15,
        ba_vl=-3,
        ob_vl=-8,
        sl_vl=-12,
    )
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    response = await client.get(f"/api/players/{player.id}")
    assert response.status_code == 200

    data = response.json()
    assert data["ba_vr"] == 5
    assert data["ob_vr"] == 10
    assert data["sl_vr"] == 15
    assert data["ba_vl"] == -3
    assert data["ob_vl"] == -8
    assert data["sl_vl"] == -12


@pytest.mark.asyncio
async def test_get_player_not_found(client):
    """Test getting non-existent player returns 404."""
    response = await client.get("/api/players/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Player not found"


@pytest.mark.asyncio
async def test_list_players_ordered_by_name(client, db_session):
    """Test that players are ordered alphabetically by last name, first name."""
    players = [
        Player(
            first_name="Zach",
            last_name="Apple",
            scoresheet_id=4001,
            primary_position="OF",
            is_trade_bait=False,
        ),
        Player(
            first_name="Aaron",
            last_name="Banana",
            scoresheet_id=4002,
            primary_position="SS",
            is_trade_bait=False,
        ),
        Player(
            first_name="Bob",
            last_name="Apple",
            scoresheet_id=4003,
            primary_position="1B",
            is_trade_bait=False,
        ),
    ]
    db_session.add_all(players)
    await db_session.commit()

    response = await client.get("/api/players")
    assert response.status_code == 200

    data = response.json()
    assert len(data["players"]) == 3

    # Should be ordered: Apple Bob, Apple Zach, Banana Aaron
    assert data["players"][0]["last_name"] == "Apple"
    assert data["players"][0]["first_name"] == "Bob"
    assert data["players"][1]["last_name"] == "Apple"
    assert data["players"][1]["first_name"] == "Zach"
    assert data["players"][2]["last_name"] == "Banana"


@pytest.mark.asyncio
async def test_list_players_includes_position_ratings(client, db_session):
    """Test that eligible_* fields return numeric ratings, not booleans."""
    # Create a multi-position player
    player = Player(
        first_name="Multi",
        last_name="Position",
        scoresheet_id=5001,
        primary_position="SS",
        is_trade_bait=False,
    )
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add multiple defensive positions with different ratings
    positions = [
        PlayerPosition(player_id=player.id, position="SS", rating=4.78),
        PlayerPosition(player_id=player.id, position="2B", rating=4.33),
        PlayerPosition(player_id=player.id, position="3B", rating=2.65),
        PlayerPosition(player_id=player.id, position="OF", rating=2.19),
    ]
    db_session.add_all(positions)
    await db_session.commit()

    # Query API
    response = await client.get("/api/players")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 1

    player_data = data["players"][0]
    # Check that eligible positions have numeric ratings
    assert player_data["eligible_ss"] == 4.78
    assert player_data["eligible_2b"] == 4.33
    assert player_data["eligible_3b"] == 2.65
    assert player_data["eligible_of"] == 2.19
    # Check that ineligible position is None
    assert player_data["eligible_1b"] is None


# ---------------------------------------------------------------------------
# League eligibility filtering tests
# ---------------------------------------------------------------------------

async def _make_al_league_and_team(db_session) -> tuple[League, Team]:
    """Create an AL league + team; returns (league, team)."""
    league = League(name="AL Test League", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    team = Team(league_id=league.id, name="AL Test Team", scoresheet_id=99)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    return league, team


async def _make_nl_league_and_team(db_session) -> tuple[League, Team]:
    """Create an NL league + team; returns (league, team)."""
    league = League(name="NL Test League", season=2026, league_type="NL")
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    team = Team(league_id=league.id, name="NL Test Team", scoresheet_id=99)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    return league, team


@pytest.mark.asyncio
async def test_al_league_returns_al_players_only(client, db_session):
    """AL league: AL-range player included; unrostered NL-range player excluded."""
    _, team = await _make_al_league_and_team(db_session)

    al_player = Player(
        first_name="AL", last_name="Guy", scoresheet_id=500,
        primary_position="OF", is_trade_bait=False,
    )
    nl_player = Player(
        first_name="NL", last_name="Guy", scoresheet_id=1500,
        primary_position="OF", is_trade_bait=False,
    )
    db_session.add_all([al_player, nl_player])
    await db_session.commit()

    response = await client.get("/api/players", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    ids = [p["scoresheet_id"] for p in data["players"]]
    assert 500 in ids
    assert 1500 not in ids


@pytest.mark.asyncio
async def test_al_league_includes_rostered_nl_players(client, db_session):
    """AL league: NL-range player with status='rostered' IS included."""
    _, team = await _make_al_league_and_team(db_session)

    nl_player = Player(
        first_name="Rostered", last_name="NL", scoresheet_id=1500,
        primary_position="1B", is_trade_bait=False,
    )
    db_session.add(nl_player)
    await db_session.commit()
    await db_session.refresh(nl_player)

    roster = PlayerRoster(player_id=nl_player.id, team_id=team.id, status="rostered")
    db_session.add(roster)
    await db_session.commit()

    response = await client.get("/api/players", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    ids = [p["scoresheet_id"] for p in data["players"]]
    assert 1500 in ids


@pytest.mark.asyncio
async def test_al_league_excludes_unknown_range(client, db_session):
    """AL league: player with scoresheet_id outside AL/NL ranges is excluded."""
    _, team = await _make_al_league_and_team(db_session)

    unknown_player = Player(
        first_name="Unknown", last_name="Range", scoresheet_id=9000,
        primary_position="P", is_trade_bait=False,
    )
    db_session.add(unknown_player)
    await db_session.commit()

    response = await client.get("/api/players", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    ids = [p["scoresheet_id"] for p in data["players"]]
    assert 9000 not in ids


@pytest.mark.asyncio
async def test_nl_league_returns_nl_players_only(client, db_session):
    """NL league: NL-range player included; unrostered AL-range player excluded."""
    _, team = await _make_nl_league_and_team(db_session)

    nl_player = Player(
        first_name="NL", last_name="Guy", scoresheet_id=1500,
        primary_position="OF", is_trade_bait=False,
    )
    al_player = Player(
        first_name="AL", last_name="Guy", scoresheet_id=500,
        primary_position="OF", is_trade_bait=False,
    )
    db_session.add_all([nl_player, al_player])
    await db_session.commit()

    response = await client.get("/api/players", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    ids = [p["scoresheet_id"] for p in data["players"]]
    assert 1500 in ids
    assert 500 not in ids


@pytest.mark.asyncio
async def test_nl_league_includes_rostered_al_players(client, db_session):
    """NL league: AL-range player with status='rostered' IS included."""
    _, team = await _make_nl_league_and_team(db_session)

    al_player = Player(
        first_name="Rostered", last_name="AL", scoresheet_id=500,
        primary_position="3B", is_trade_bait=False,
    )
    db_session.add(al_player)
    await db_session.commit()
    await db_session.refresh(al_player)

    roster = PlayerRoster(player_id=al_player.id, team_id=team.id, status="rostered")
    db_session.add(roster)
    await db_session.commit()

    response = await client.get("/api/players", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    ids = [p["scoresheet_id"] for p in data["players"]]
    assert 500 in ids


@pytest.mark.asyncio
async def test_bl_league_returns_all_scoresheet_players(client, db_session):
    """BL league: no eligibility filtering; all scoresheet players returned."""
    league = League(name="BL Test League", season=2026, league_type="BL")
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    team = Team(league_id=league.id, name="BL Test Team", scoresheet_id=99)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    players = [
        Player(first_name="A", last_name="P1", scoresheet_id=500, primary_position="OF", is_trade_bait=False),
        Player(first_name="B", last_name="P2", scoresheet_id=1500, primary_position="1B", is_trade_bait=False),
        Player(first_name="C", last_name="P3", scoresheet_id=9000, primary_position="P", is_trade_bait=False),
    ]
    db_session.add_all(players)
    await db_session.commit()

    response = await client.get("/api/players", headers={"X-Team-Id": str(team.id)})
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 3


@pytest.mark.asyncio
async def test_no_league_context_returns_all(client, db_session):
    """Without X-Team-Id header, all scoresheet players returned (backward compat)."""
    players = [
        Player(first_name="A", last_name="P1", scoresheet_id=500, primary_position="OF", is_trade_bait=False),
        Player(first_name="B", last_name="P2", scoresheet_id=1500, primary_position="1B", is_trade_bait=False),
        Player(first_name="C", last_name="P3", scoresheet_id=9000, primary_position="P", is_trade_bait=False),
    ]
    db_session.add_all(players)
    await db_session.commit()

    # No X-Team-Id header; app settings DEFAULT_TEAM_ID won't resolve (test DB is empty of teams)
    response = await client.get("/api/players")
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 3
