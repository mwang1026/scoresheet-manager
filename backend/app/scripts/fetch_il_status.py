#!/usr/bin/env python3
"""
Fetch IL status from MLB Stats API and persist to the database.

Usage:
    python -m app.scripts.fetch_il_status
"""

import logging

from app.logging_config import setup_logging

setup_logging()

from app.scripts import get_session, run_async
from app.services.il_status import fetch_and_persist_il_status

logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("Starting IL status fetch...")
    async for session in get_session():
        summary = await fetch_and_persist_il_status(session)
        logger.info("IL status fetch summary: %s", summary)


if __name__ == "__main__":
    run_async(main())
