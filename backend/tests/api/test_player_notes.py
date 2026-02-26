"""Tests for single-note player notes endpoints."""

import pytest

from app.models import Player, Team, User, UserTeam
from app.models.player_note import PlayerNote


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_player(db_session, sample_player_data, scoresheet_id=9999, mlb_id=999999):
    player = Player(**{**sample_player_data, "scoresheet_id": scoresheet_id, "mlb_id": mlb_id})
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)
    return player


# ---------------------------------------------------------------------------
# GET /api/players/{player_id}/note — single note
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_note_none(client, db_session, setup_team_context, sample_player_data):
    """GET note for a player with no note returns null."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.get(f"/api/players/{player.id}/note")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_get_note_exists(client, db_session, setup_team_context, sample_player_data):
    """GET note returns the note when it exists."""
    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    note = PlayerNote(team_id=team.id, player_id=player.id, content="Breakout candidate")
    db_session.add(note)
    await db_session.commit()

    response = await client.get(f"/api/players/{player.id}/note")
    assert response.status_code == 200
    data = response.json()
    assert data["player_id"] == player.id
    assert data["content"] == "Breakout candidate"
    assert "updated_at" in data


# ---------------------------------------------------------------------------
# PUT /api/players/{player_id}/note — upsert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upsert_create_new(client, db_session, setup_team_context, sample_player_data):
    """PUT creates a new note when none exists."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.put(
        f"/api/players/{player.id}/note",
        json={"content": "Looks good in spring training"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Looks good in spring training"
    assert data["player_id"] == player.id


@pytest.mark.asyncio
async def test_upsert_update_existing(client, db_session, setup_team_context, sample_player_data):
    """PUT updates an existing note."""
    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    note = PlayerNote(team_id=team.id, player_id=player.id, content="original")
    db_session.add(note)
    await db_session.commit()

    response = await client.put(
        f"/api/players/{player.id}/note",
        json={"content": "updated content"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "updated content"


@pytest.mark.asyncio
async def test_upsert_empty_deletes(client, db_session, setup_team_context, sample_player_data):
    """PUT with empty content deletes the note."""
    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    note = PlayerNote(team_id=team.id, player_id=player.id, content="to delete")
    db_session.add(note)
    await db_session.commit()

    response = await client.put(
        f"/api/players/{player.id}/note",
        json={"content": ""},
    )
    assert response.status_code == 204

    # Confirm gone
    get_response = await client.get(f"/api/players/{player.id}/note")
    assert get_response.json() is None


@pytest.mark.asyncio
async def test_upsert_whitespace_deletes(client, db_session, setup_team_context, sample_player_data):
    """PUT with whitespace-only content deletes the note."""
    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    note = PlayerNote(team_id=team.id, player_id=player.id, content="to delete")
    db_session.add(note)
    await db_session.commit()

    response = await client.put(
        f"/api/players/{player.id}/note",
        json={"content": "   \n  "},
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_upsert_empty_no_note_is_noop(client, db_session, setup_team_context, sample_player_data):
    """PUT with empty content when no note exists returns 204 without error."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.put(
        f"/api/players/{player.id}/note",
        json={"content": ""},
    )
    assert response.status_code == 204


# ---------------------------------------------------------------------------
# GET /api/notes — bulk fetch
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bulk_notes_empty(client, db_session, setup_team_context, sample_player_data):
    """GET bulk returns empty dict when team has no notes."""
    response = await client.get("/api/notes")
    assert response.status_code == 200
    assert response.json() == {"notes": {}}


@pytest.mark.asyncio
async def test_bulk_notes_multiple(client, db_session, setup_team_context, sample_player_data):
    """GET bulk returns notes for multiple players."""
    team = setup_team_context["team"]
    p1 = await _create_player(db_session, sample_player_data, scoresheet_id=100, mlb_id=100000)
    p2 = await _create_player(db_session, sample_player_data, scoresheet_id=101, mlb_id=100001)

    db_session.add_all([
        PlayerNote(team_id=team.id, player_id=p1.id, content="Note for p1"),
        PlayerNote(team_id=team.id, player_id=p2.id, content="Note for p2"),
    ])
    await db_session.commit()

    response = await client.get("/api/notes")
    assert response.status_code == 200
    notes = response.json()["notes"]
    assert notes[str(p1.id)] == "Note for p1"
    assert notes[str(p2.id)] == "Note for p2"


@pytest.mark.asyncio
async def test_bulk_notes_only_current_team(client, db_session, sample_league, sample_player_data):
    """GET bulk only returns notes for the requesting team."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=10)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=11)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session, sample_player_data)

    db_session.add(PlayerNote(team_id=team_a.id, player_id=player.id, content="Team A note"))
    db_session.add(PlayerNote(team_id=team_b.id, player_id=player.id, content="Team B note"))
    await db_session.commit()

    # Request as team A
    response = await client.get(
        "/api/notes",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 200
    notes = response.json()["notes"]
    assert notes[str(player.id)] == "Team A note"
    assert len(notes) == 1


# ---------------------------------------------------------------------------
# Team isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_team_isolation_get(client, db_session, sample_league, sample_player_data):
    """Team A cannot see Team B's note via GET single."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=10)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=11)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session, sample_player_data)
    db_session.add(PlayerNote(team_id=team_b.id, player_id=player.id, content="secret"))
    await db_session.commit()

    response = await client.get(
        f"/api/players/{player.id}/note",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_team_isolation_upsert(client, db_session, sample_league, sample_player_data):
    """Team A cannot overwrite Team B's note — each team has its own slot."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=12)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=13)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session, sample_player_data)
    db_session.add(PlayerNote(team_id=team_b.id, player_id=player.id, content="B's note"))
    await db_session.commit()

    # Team A writes their own note — should not overwrite B's
    response = await client.put(
        f"/api/players/{player.id}/note",
        json={"content": "A's note"},
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "A's note"

    # Verify B's note is untouched
    response_b = await client.get(
        f"/api/players/{player.id}/note",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_b.id)},
    )
    assert response_b.json()["content"] == "B's note"


# ---------------------------------------------------------------------------
# Round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roundtrip(client, db_session, setup_team_context, sample_player_data):
    """Create via PUT, verify via GET single and GET bulk."""
    player = await _create_player(db_session, sample_player_data)

    # Create
    await client.put(
        f"/api/players/{player.id}/note",
        json={"content": "Draft target"},
    )

    # Verify via single GET
    single = await client.get(f"/api/players/{player.id}/note")
    assert single.json()["content"] == "Draft target"

    # Verify via bulk GET
    bulk = await client.get("/api/notes")
    assert bulk.json()["notes"][str(player.id)] == "Draft target"
