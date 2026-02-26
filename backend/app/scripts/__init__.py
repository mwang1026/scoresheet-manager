"""Import utilities for data loading."""

import asyncio
import logging
import sys
from collections.abc import AsyncGenerator
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal

T = TypeVar("T")

logger = logging.getLogger(__name__)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for import scripts."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def run_async(coro):
    """Run an async function from a script entry point."""
    try:
        asyncio.run(coro)
    except KeyboardInterrupt:
        logger.info("Import cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error("Error: %s", e)
        sys.exit(1)
