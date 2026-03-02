"""Centralized logging configuration with per-request ID correlation.

Uses a ContextVar to propagate the request ID through the async call chain
so that service-layer code (mlb_stats_api, scoresheet_scraper) can include
the request ID in log messages without needing a reference to the Request object.
"""

import logging
import sys
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    """Inject ``request_id`` from the ContextVar into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()  # type: ignore[attr-defined]
        return True


def setup_logging() -> None:
    """Configure the root logger for the application.

    - Reads ``LOG_LEVEL`` env var (default ``INFO``)
    - Outputs to stdout (Railway reads stdout)
    - Silences noisy third-party loggers at WARNING
    """
    import os

    level = os.environ.get("LOG_LEVEL", "INFO").upper()

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s - %(message)s")
    )

    root = logging.getLogger()
    root.setLevel(level)
    # Avoid duplicate handlers if called more than once (e.g. tests)
    root.handlers.clear()
    root.addHandler(handler)

    # Silence noisy third-party loggers
    for name in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)
