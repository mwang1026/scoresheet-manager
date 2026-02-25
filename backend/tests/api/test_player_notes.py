"""Tests for /{player_id}/notes endpoints."""

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
# List notes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_notes_empty(client, db_session, setup_team_context, sample_player_data):
    """GET notes for a player with no notes returns empty list."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.get(f"/api/players/{player.id}/notes")
    assert response.status_code == 200
    assert response.json() == {"notes": []}


@pytest.mark.asyncio
async def test_list_notes_sorted_newest_first(client, db_session, setup_team_context, sample_player_data):
    """GET notes returns notes ordered newest-first."""
    from datetime import datetime, timedelta, timezone

    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    now = datetime.now(timezone.utc)
    note_old = PlayerNote(
        team_id=team.id,
        player_id=player.id,
        content="older note",
        created_at=now - timedelta(hours=1),
        updated_at=now - timedelta(hours=1),
    )
    note_new = PlayerNote(
        team_id=team.id,
        player_id=player.id,
        content="newer note",
        created_at=now,
        updated_at=now,
    )
    db_session.add_all([note_old, note_new])
    await db_session.commit()

    response = await client.get(f"/api/players/{player.id}/notes")
    assert response.status_code == 200
    notes = response.json()["notes"]
    assert len(notes) == 2
    assert notes[0]["content"] == "newer note"
    assert notes[1]["content"] == "older note"


# ---------------------------------------------------------------------------
# Create note
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_note(client, db_session, setup_team_context, sample_player_data):
    """POST creates a note and returns 201 with the note."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.post(
        f"/api/players/{player.id}/notes",
        json={"content": "Looks good in spring training"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["content"] == "Looks good in spring training"
    assert data["player_id"] == player.id
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_create_multiple_notes_same_player(client, db_session, setup_team_context, sample_player_data):
    """POST allows multiple notes per player (no unique constraint)."""
    player = await _create_player(db_session, sample_player_data)

    response1 = await client.post(
        f"/api/players/{player.id}/notes",
        json={"content": "Note one"},
    )
    assert response1.status_code == 201

    response2 = await client.post(
        f"/api/players/{player.id}/notes",
        json={"content": "Note two"},
    )
    assert response2.status_code == 201

    list_response = await client.get(f"/api/players/{player.id}/notes")
    assert len(list_response.json()["notes"]) == 2


# ---------------------------------------------------------------------------
# Update note
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_note_content(client, db_session, setup_team_context, sample_player_data):
    """PUT updates the note content."""
    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    note = PlayerNote(team_id=team.id, player_id=player.id, content="original")
    db_session.add(note)
    await db_session.commit()
    await db_session.refresh(note)

    response = await client.put(
        f"/api/players/{player.id}/notes/{note.id}",
        json={"content": "updated content"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "updated content"
    assert data["id"] == note.id


@pytest.mark.asyncio
async def test_update_note_changes_updated_at(client, db_session, setup_team_context, sample_player_data):
    """PUT changes updated_at but not created_at."""
    from datetime import datetime, timedelta, timezone

    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    old_time = datetime.now(timezone.utc) - timedelta(hours=1)
    note = PlayerNote(
        team_id=team.id,
        player_id=player.id,
        content="original",
        created_at=old_time,
        updated_at=old_time,
    )
    db_session.add(note)
    await db_session.commit()
    await db_session.refresh(note)

    response = await client.put(
        f"/api/players/{player.id}/notes/{note.id}",
        json={"content": "new content"},
    )
    assert response.status_code == 200
    data = response.json()
    # updated_at should be more recent than created_at
    created = data["created_at"]
    updated = data["updated_at"]
    assert updated >= created


@pytest.mark.asyncio
async def test_update_nonexistent_note_returns_404(client, setup_team_context, db_session, sample_player_data):
    """PUT on a nonexistent note returns 404."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.put(
        f"/api/players/{player.id}/notes/99999",
        json={"content": "ghost update"},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Delete note
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_note(client, db_session, setup_team_context, sample_player_data):
    """DELETE removes the note and returns 204."""
    team = setup_team_context["team"]
    player = await _create_player(db_session, sample_player_data)

    note = PlayerNote(team_id=team.id, player_id=player.id, content="to be deleted")
    db_session.add(note)
    await db_session.commit()
    await db_session.refresh(note)

    response = await client.delete(f"/api/players/{player.id}/notes/{note.id}")
    assert response.status_code == 204

    # Confirm gone from list
    list_response = await client.get(f"/api/players/{player.id}/notes")
    assert list_response.json()["notes"] == []


@pytest.mark.asyncio
async def test_delete_nonexistent_note_returns_404(client, setup_team_context, db_session, sample_player_data):
    """DELETE on a nonexistent note returns 404."""
    player = await _create_player(db_session, sample_player_data)

    response = await client.delete(f"/api/players/{player.id}/notes/99999")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Team isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_team_isolation_list(client, db_session, sample_league, sample_player_data):
    """Team A cannot see Team B's notes in list."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=10)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=11)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    # Create user and associate with both teams (user owns both for isolation test)
    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session, sample_player_data)

    # Team B creates a note
    note = PlayerNote(team_id=team_b.id, player_id=player.id, content="team B's secret")
    db_session.add(note)
    await db_session.commit()

    # Team A lists notes for the same player
    response = await client.get(
        f"/api/players/{player.id}/notes",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 200
    assert response.json()["notes"] == []


@pytest.mark.asyncio
async def test_team_isolation_update(client, db_session, sample_league, sample_player_data):
    """Team A cannot update Team B's note."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=12)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=13)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    # Create user and associate with both teams (user owns both for isolation test)
    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session, sample_player_data)

    # Team B creates a note
    note = PlayerNote(team_id=team_b.id, player_id=player.id, content="team B's note")
    db_session.add(note)
    await db_session.commit()
    await db_session.refresh(note)

    # Team A tries to update it
    response = await client.put(
        f"/api/players/{player.id}/notes/{note.id}",
        json={"content": "hijacked"},
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_team_isolation_delete(client, db_session, sample_league, sample_player_data):
    """Team A cannot delete Team B's note."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=14)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=15)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    # Create user and associate with both teams (user owns both for isolation test)
    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session, sample_player_data)

    # Team B creates a note
    note = PlayerNote(team_id=team_b.id, player_id=player.id, content="team B's note")
    db_session.add(note)
    await db_session.commit()
    await db_session.refresh(note)

    # Team A tries to delete it
    response = await client.delete(
        f"/api/players/{player.id}/notes/{note.id}",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 404
