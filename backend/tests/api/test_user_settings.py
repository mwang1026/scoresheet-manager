"""Tests for /api/me/settings endpoints."""

import pytest

# The get_current_user dependency resolves via X-User-Email header.
# setup_team_context creates a user with email "test@example.com".
USER_HEADERS = {"X-User-Email": "test@example.com"}


# ---------------------------------------------------------------------------
# GET /api/me/settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_settings_empty(client, setup_team_context):
    """GET returns null when no settings have been saved."""
    response = await client.get("/api/me/settings", headers=USER_HEADERS)
    assert response.status_code == 200
    assert response.json() is None


# ---------------------------------------------------------------------------
# PUT /api/me/settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_settings_creates(client, setup_team_context):
    """PUT creates settings and returns 200 with the saved data."""
    payload = {"settings_json": {"version": 1, "theme": "dark"}}
    response = await client.put("/api/me/settings", json=payload, headers=USER_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["settings_json"] == {"version": 1, "theme": "dark"}
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_put_settings_updates(client, setup_team_context):
    """PUT updates existing settings (idempotent upsert)."""
    # Create initial settings
    await client.put(
        "/api/me/settings",
        json={"settings_json": {"version": 1, "foo": "bar"}},
        headers=USER_HEADERS,
    )

    # Update with new data
    response = await client.put(
        "/api/me/settings",
        json={"settings_json": {"version": 1, "foo": "baz"}},
        headers=USER_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["settings_json"]["foo"] == "baz"


@pytest.mark.asyncio
async def test_get_settings_returns_saved(client, setup_team_context):
    """GET returns the settings previously saved via PUT."""
    payload = {"settings_json": {"version": 1, "dashboard": {"statsSource": "actual"}}}
    await client.put("/api/me/settings", json=payload, headers=USER_HEADERS)

    response = await client.get("/api/me/settings", headers=USER_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["settings_json"]["dashboard"]["statsSource"] == "actual"


@pytest.mark.asyncio
async def test_put_settings_validates_json(client, setup_team_context):
    """PUT with an invalid body (missing settings_json) returns 422."""
    response = await client.put(
        "/api/me/settings", json={"wrong_field": "value"}, headers=USER_HEADERS
    )
    assert response.status_code == 422
