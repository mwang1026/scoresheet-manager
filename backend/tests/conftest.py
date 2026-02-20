"""Pytest configuration and fixtures."""

import asyncio
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base

# Use in-memory SQLite for tests (faster, isolated)
TEST_DATABASE_URL = "sqlite+pysqlite:///:memory:"
TEST_DATABASE_URL_ASYNC = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def async_engine():
    """Create async engine for each test (in-memory, isolated)."""
    engine = create_async_engine(
        TEST_DATABASE_URL_ASYNC,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
def sync_engine():
    """Create sync engine for import script tests."""
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async_session_maker = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with overridden database dependency."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_player_data() -> dict[str, Any]:
    """Sample Scoresheet player data for tests."""
    return {
        "first_name": "Test",
        "last_name": "Player",
        "scoresheet_id": 9999,
        "mlb_id": 999999,
        "bp_id": 88888,
        "primary_position": "SS",
        "bats": "R",
        "throws": "R",
        "age": 25,
        "current_mlb_team": "TST",
        "is_trade_bait": False,
    }


@pytest.fixture
def sample_pecota_player_data() -> dict[str, Any]:
    """Sample PECOTA-only player data (no scoresheet_id)."""
    return {
        "first_name": "PECOTA",
        "last_name": "Only",
        "scoresheet_id": None,  # PECOTA-only player
        "mlb_id": 777777,
        "bp_id": 66666,
        "primary_position": "OF",
        "bats": "L",
        "throws": "L",
        "age": 23,
        "current_mlb_team": "MIN",
        "is_trade_bait": False,
    }
