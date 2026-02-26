"""Tests for request logging middleware."""

import logging
import re

import pytest

from app.logging_config import request_id_var


@pytest.mark.asyncio
async def test_response_has_request_id_header(client):
    """Every response should include an X-Request-ID header (12-char hex)."""
    response = await client.get("/api/health")
    request_id = response.headers.get("X-Request-ID")
    assert request_id is not None
    assert re.fullmatch(r"[0-9a-f]{12}", request_id)


@pytest.mark.asyncio
async def test_request_id_unique_per_request(client):
    """Each request should get a different request ID."""
    r1 = await client.get("/api/health")
    r2 = await client.get("/api/health")
    assert r1.headers["X-Request-ID"] != r2.headers["X-Request-ID"]


@pytest.mark.asyncio
async def test_normal_request_logs_info(client, caplog):
    """Successful requests should produce an INFO-level log line."""
    with caplog.at_level(logging.INFO, logger="app.middleware.request_logging"):
        response = await client.get("/api/players")
    # Find the request log line (not health check)
    log_lines = [r for r in caplog.records if "/api/players" in r.message]
    assert len(log_lines) >= 1
    record = log_lines[0]
    assert record.levelno == logging.INFO
    assert "GET" in record.message
    assert str(response.status_code) in record.message


@pytest.mark.asyncio
async def test_4xx_request_logs_warning(client, caplog):
    """4xx responses should produce a WARNING-level log line."""
    with caplog.at_level(logging.WARNING, logger="app.middleware.request_logging"):
        await client.get("/api/nonexistent-endpoint-12345")
    log_lines = [
        r for r in caplog.records
        if "nonexistent-endpoint-12345" in r.message
    ]
    assert len(log_lines) >= 1
    assert log_lines[0].levelno == logging.WARNING


@pytest.mark.asyncio
async def test_health_check_not_logged(client, caplog):
    """Health check requests should NOT produce INFO-level log output."""
    with caplog.at_level(logging.INFO, logger="app.middleware.request_logging"):
        await client.get("/api/health")
    health_logs = [r for r in caplog.records if "/api/health" in r.message]
    assert len(health_logs) == 0


@pytest.mark.asyncio
async def test_request_id_var_reset_after_request(client):
    """ContextVar should be reset to default after each request completes."""
    await client.get("/api/health")
    assert request_id_var.get() == "-"
