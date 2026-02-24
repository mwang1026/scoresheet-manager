"""Tests for POST /api/auth/check-email."""

import pytest

from app.models import User


@pytest.mark.asyncio
async def test_check_email_allowed(client, db_session):
    """Seeded email in users table → allowed=true."""
    user = User(email="allowed@example.com", role="user")
    db_session.add(user)
    await db_session.commit()

    response = await client.post(
        "/api/auth/check-email",
        json={"email": "allowed@example.com"},
    )
    assert response.status_code == 200
    assert response.json() == {"allowed": True}


@pytest.mark.asyncio
async def test_check_email_not_allowed(client):
    """Unknown email → allowed=false."""
    response = await client.post(
        "/api/auth/check-email",
        json={"email": "stranger@example.com"},
    )
    assert response.status_code == 200
    assert response.json() == {"allowed": False}


@pytest.mark.asyncio
async def test_check_email_missing_body(client):
    """Missing body → 422 Unprocessable Entity."""
    response = await client.post("/api/auth/check-email")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_check_email_missing_field(client):
    """Body missing email field → 422."""
    response = await client.post(
        "/api/auth/check-email",
        json={"not_email": "oops"},
    )
    assert response.status_code == 422
