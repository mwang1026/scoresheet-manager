"""Tests for draft notes endpoints."""

import pytest

from app.models import Team, User, UserTeam
from app.models.draft_note import DraftNote


# ---------------------------------------------------------------------------
# GET /api/draft/notes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_note_none(client, db_session, setup_team_context):
    """GET draft note when none exists returns null."""
    response = await client.get("/api/draft/notes")
    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_get_note_exists(client, db_session, setup_team_context):
    """GET draft note returns the note when it exists."""
    team = setup_team_context["team"]

    note = DraftNote(team_id=team.id, content="Target SP early")
    db_session.add(note)
    await db_session.commit()

    response = await client.get("/api/draft/notes")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Target SP early"
    assert "updated_at" in data


# ---------------------------------------------------------------------------
# PUT /api/draft/notes — upsert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upsert_create_new(client, db_session, setup_team_context):
    """PUT creates a new draft note when none exists."""
    response = await client.put(
        "/api/draft/notes",
        json={"content": "Draft strategy: best player available"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Draft strategy: best player available"


@pytest.mark.asyncio
async def test_upsert_update_existing(client, db_session, setup_team_context):
    """PUT updates an existing draft note."""
    team = setup_team_context["team"]

    note = DraftNote(team_id=team.id, content="original")
    db_session.add(note)
    await db_session.commit()

    response = await client.put(
        "/api/draft/notes",
        json={"content": "updated content"},
    )
    assert response.status_code == 200
    assert response.json()["content"] == "updated content"


@pytest.mark.asyncio
async def test_upsert_empty_deletes(client, db_session, setup_team_context):
    """PUT with empty content deletes the note."""
    team = setup_team_context["team"]

    note = DraftNote(team_id=team.id, content="to delete")
    db_session.add(note)
    await db_session.commit()

    response = await client.put(
        "/api/draft/notes",
        json={"content": ""},
    )
    assert response.status_code == 204

    # Confirm gone
    get_response = await client.get("/api/draft/notes")
    assert get_response.json() is None


@pytest.mark.asyncio
async def test_upsert_whitespace_deletes(client, db_session, setup_team_context):
    """PUT with whitespace-only content deletes the note."""
    team = setup_team_context["team"]

    note = DraftNote(team_id=team.id, content="to delete")
    db_session.add(note)
    await db_session.commit()

    response = await client.put(
        "/api/draft/notes",
        json={"content": "   \n  "},
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_upsert_empty_no_note_is_noop(client, db_session, setup_team_context):
    """PUT with empty content when no note exists returns 204 without error."""
    response = await client.put(
        "/api/draft/notes",
        json={"content": ""},
    )
    assert response.status_code == 204


# ---------------------------------------------------------------------------
# Team isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_team_isolation(client, db_session, sample_league):
    """Team A cannot see Team B's draft note."""
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

    # Team B creates a note
    db_session.add(DraftNote(team_id=team_b.id, content="secret strategy"))
    await db_session.commit()

    # Team A should not see it
    response = await client.get(
        "/api/draft/notes",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 200
    assert response.json() is None

    # Team B sees their own
    response_b = await client.get(
        "/api/draft/notes",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_b.id)},
    )
    assert response_b.json()["content"] == "secret strategy"


# ---------------------------------------------------------------------------
# Round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_roundtrip(client, db_session, setup_team_context):
    """Create via PUT, verify via GET, update, delete."""
    # Create
    await client.put("/api/draft/notes", json={"content": "Draft target: SP"})

    # Verify via GET
    get_resp = await client.get("/api/draft/notes")
    assert get_resp.json()["content"] == "Draft target: SP"

    # Update
    await client.put("/api/draft/notes", json={"content": "Updated: target RP"})
    get_resp2 = await client.get("/api/draft/notes")
    assert get_resp2.json()["content"] == "Updated: target RP"

    # Delete
    del_resp = await client.put("/api/draft/notes", json={"content": ""})
    assert del_resp.status_code == 204
    get_resp3 = await client.get("/api/draft/notes")
    assert get_resp3.json() is None
