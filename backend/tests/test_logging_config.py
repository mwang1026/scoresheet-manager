"""Tests for centralized logging configuration."""

import logging

import pytest

from app.logging_config import RequestIdFilter, request_id_var, setup_logging


class TestRequestIdFilter:
    def test_sets_request_id_from_contextvar(self):
        """Filter should inject the ContextVar value into the log record."""
        token = request_id_var.set("abc123def456")
        try:
            filt = RequestIdFilter()
            record = logging.LogRecord(
                name="test", level=logging.INFO, pathname="", lineno=0,
                msg="hello", args=(), exc_info=None,
            )
            result = filt.filter(record)
            assert result is True
            assert record.request_id == "abc123def456"  # type: ignore[attr-defined]
        finally:
            request_id_var.reset(token)

    def test_defaults_to_dash_when_no_contextvar(self):
        """Filter should default to '-' when no request ID is set."""
        # Ensure ContextVar is at default state
        filt = RequestIdFilter()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0,
            msg="hello", args=(), exc_info=None,
        )
        filt.filter(record)
        assert record.request_id == "-"  # type: ignore[attr-defined]


class TestSetupLogging:
    def test_configures_root_logger(self):
        """setup_logging should configure root logger with handler and format."""
        setup_logging()
        root = logging.getLogger()

        assert len(root.handlers) == 1
        handler = root.handlers[0]
        assert isinstance(handler, logging.StreamHandler)

        # Verify format includes request_id placeholder
        assert "%(request_id)s" in handler.formatter._fmt

    def test_respects_log_level_env(self, monkeypatch):
        """setup_logging should read LOG_LEVEL from env."""
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        setup_logging()
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_silences_noisy_loggers(self):
        """Third-party loggers should be silenced at WARNING."""
        setup_logging()
        for name in ("uvicorn.access", "httpx", "httpcore"):
            assert logging.getLogger(name).level == logging.WARNING

    def test_idempotent_no_duplicate_handlers(self):
        """Calling setup_logging twice should not add duplicate handlers."""
        setup_logging()
        setup_logging()
        root = logging.getLogger()
        assert len(root.handlers) == 1
