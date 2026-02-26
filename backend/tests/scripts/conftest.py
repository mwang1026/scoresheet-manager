"""Shared fixtures for script tests."""

import pytest
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def sync_session(sync_engine):
    """Create a sync session for testing sync script functions."""
    SessionLocal = sessionmaker(bind=sync_engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def make_mock_get_session(db_session):
    """Factory to create mock get_session for async script tests."""

    def _make():
        async def mock_get_session():
            yield db_session

        return mock_get_session

    return _make
