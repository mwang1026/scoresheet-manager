"""Import utilities for data loading."""

import asyncio
import sys
from collections.abc import AsyncGenerator
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal

T = TypeVar("T")


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
        print("\nImport cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
