import asyncio
import logging
from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

_MAX_CONNECT_RETRIES = 3
_CONNECT_RETRY_DELAY = 1.0  # seconds

# Async engine for FastAPI
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,   # Test connections before use, replace dead ones
    pool_recycle=300,      # Recycle connections every 5 min to prevent stale conns
    pool_size=10,          # Handle concurrent page-load requests (default was 5)
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Sync engine for scripts (convert postgresql+asyncpg:// to postgresql+psycopg://)
sync_database_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg")
sync_engine = create_engine(sync_database_url, echo=False)

SessionLocal = sessionmaker(
    sync_engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions with connection retry."""
    last_err: Exception | None = None
    for attempt in range(_MAX_CONNECT_RETRIES):
        session = AsyncSessionLocal()
        try:
            # Eagerly verify connection is alive (triggers DNS/connect errors now,
            # not mid-query). pool_pre_ping handles stale pooled conns;
            # this retry handles connection *creation* failures (DNS blips, etc.).
            await session.connection()
            break
        except OperationalError as e:
            await session.close()
            last_err = e
            if attempt < _MAX_CONNECT_RETRIES - 1:
                logger.warning(
                    "DB connection attempt %d/%d failed, retrying in %ss: %s",
                    attempt + 1,
                    _MAX_CONNECT_RETRIES,
                    _CONNECT_RETRY_DELAY,
                    e,
                )
                await asyncio.sleep(_CONNECT_RETRY_DELAY)
    else:
        raise last_err  # type: ignore[misc]

    try:
        yield session
    finally:
        await session.close()
