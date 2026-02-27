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


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter storage before each test to prevent 429 errors.

    All test requests share the same remote address, so without this reset
    rate-limited endpoints would accumulate hits across tests within the same
    minute window and start returning 429.

    We reset the storage on the *original* module-level limiter rather than
    replacing app.state.limiter with a new instance. SlowAPIMiddleware reads
    the rate-limit annotations from endpoint function objects (which reference
    the original limiter), so replacing the instance doesn't fully decouple
    the storage.
    """
    from app.api.endpoints.scoresheet import limiter as scoresheet_limiter

    scoresheet_limiter._storage.reset()
    app.state.limiter = scoresheet_limiter
    yield


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
        "scoresheet_id": 100,
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


@pytest.fixture
def sample_hitter_stats_data() -> dict[str, Any]:
    """Sample hitter daily stats data."""
    from datetime import date

    return {
        "date": date(2025, 9, 1),
        "g": 1,
        "pa": 4,
        "ab": 3,
        "h": 2,
        "single": 1,
        "double": 1,
        "triple": 0,
        "hr": 0,
        "tb": 3,
        "r": 1,
        "rbi": 2,
        "so": 1,
        "go": 0,
        "fo": 0,
        "ao": 0,
        "gdp": 0,
        "bb": 1,
        "ibb": 0,
        "hbp": 0,
        "sb": 0,
        "cs": 0,
        "sf": 0,
        "sh": 0,
        "lob": 1,
    }


@pytest.fixture
def sample_pitcher_stats_data() -> dict[str, Any]:
    """Sample pitcher daily stats data."""
    from datetime import date

    return {
        "date": date(2025, 9, 1),
        "g": 1,
        "gs": 1,
        "gf": 0,
        "cg": 0,
        "sho": 0,
        "sv": 0,
        "svo": 0,
        "bs": 0,
        "hld": 0,
        "ip_outs": 18,  # 6.0 IP
        "w": 1,
        "l": 0,
        "er": 2,
        "r": 2,
        "bf": 24,
        "ab": 22,
        "h": 5,
        "double": 1,
        "triple": 0,
        "hr": 1,
        "tb": 9,
        "bb": 2,
        "ibb": 0,
        "hbp": 0,
        "k": 6,
        "go": 8,
        "fo": 4,
        "ao": 0,
        "sb": 0,
        "cs": 0,
        "sf": 0,
        "sh": 0,
        "wp": 0,
        "bk": 0,
        "pk": 0,
        "ir": 0,
        "irs": 0,
        "pitches": 95,
        "strikes": 62,
    }


@pytest.fixture
def sample_league_data() -> dict[str, Any]:
    """Sample league data."""
    return {
        "name": "Test League",
        "season": 2026,
        "league_type": "AL",
    }


@pytest.fixture
async def sample_league(db_session: AsyncSession, sample_league_data: dict[str, Any]):
    """Create and return a sample league in the database."""
    from app.models import League

    league = League(**sample_league_data)
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)
    return league


@pytest.fixture
def sample_team_data(sample_league) -> dict[str, Any]:
    """Sample team data."""
    return {
        "league_id": sample_league.id,
        "name": "Test Team",
        "scoresheet_id": 1,
    }


@pytest.fixture
def sample_hitter_projection_data() -> dict[str, Any]:
    """Sample hitter projection data."""
    return {
        "source": "PECOTA-50",
        "season": 2026,
        "pa": 600,
        "g": 150,
        "ab": 540,
        "r": 85,
        "b1": 90,  # singles
        "b2": 30,  # doubles
        "b3": 3,   # triples
        "hr": 25,
        "h": 148,
        "tb": 254,
        "rbi": 80,
        "bb": 55,
        "hbp": 5,
        "so": 140,
        "sb": 10,
        "cs": 3,
        # Rate stats
        "avg": 0.274,
        "obp": 0.345,
        "slg": 0.470,
        "babip": 0.300,
        # Advanced metrics
        "drc_plus": 110,
        "vorp": 25.5,
        "warp": 3.2,
    }


@pytest.fixture
def sample_pitcher_projection_data() -> dict[str, Any]:
    """Sample pitcher projection data."""
    return {
        "source": "PECOTA-50",
        "season": 2026,
        "w": 12,
        "l": 8,
        "sv": 0,
        "hld": 0,
        "g": 30,
        "gs": 30,
        "qs": 18,
        "bf": 750,
        "ip_outs": 540,  # 180.0 IP
        "h": 170,
        "hr": 20,
        "bb": 50,
        "hbp": 5,
        "so": 190,
        # Rate stats
        "era": 3.50,
        "whip": 1.22,
        "babip": 0.295,
        "bb9": 2.5,
        "so9": 9.5,
        # Advanced metrics
        "fip": 3.40,
        "dra": 3.60,
        "dra_minus": 95,
        "warp": 4.5,
        "gb_percent": 45.5,
    }


@pytest.fixture
async def setup_team_context(db_session: AsyncSession, sample_league):
    """
    Set up team context for multi-user tests.

    Creates: League, Team, User, UserTeam association.
    Returns dict with references to all created entities.

    Also overrides get_current_user so tests work regardless of AUTH_SECRET.
    """
    from app.api.dependencies import get_current_user
    from app.main import app
    from app.models import Team, User, UserTeam

    # Create team
    team = Team(
        league_id=sample_league.id,
        name="Test Team",
        scoresheet_id=1,
    )
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    # Create user
    user = User(id=1, email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Create user-team association
    user_team = UserTeam(user_id=user.id, team_id=team.id, role="owner")
    db_session.add(user_team)
    await db_session.commit()

    # Override get_current_user so tests work regardless of AUTH_SECRET.
    # If X-User-Email is present, look up that user (supports multi-user tests).
    # Otherwise, fall back to the default test user.
    from fastapi import Request
    from sqlalchemy import select as sa_select

    async def override_get_current_user(request: Request):
        email = request.headers.get("X-User-Email")
        if email:
            result = await db_session.execute(sa_select(User).where(User.email == email))
            found = result.scalar_one_or_none()
            if found:
                return found
        return user

    app.dependency_overrides[get_current_user] = override_get_current_user

    yield {
        "league": sample_league,
        "team": team,
        "user": user,
        "user_team": user_team,
    }

    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def setup_multi_team_context(db_session: AsyncSession):
    """Multi-league, multi-user, multi-team fixture for M2M testing.

    Creates:
      - League A (AL, id auto) with teams A1, A2, A3
      - League B (NL, id auto) with teams B1, B2, B3
      - User 1 (user1@test.com): owns team A1 only
      - User 2 (user2@test.com): owns team A2 AND team B1 (cross-league)

    Returns dict with all entities for test access.
    """
    from app.models import League, Team, User, UserTeam

    # Leagues
    league_a = League(name="AL Test League", season=2026, league_type="AL")
    league_b = League(name="NL Test League", season=2026, league_type="NL")
    db_session.add_all([league_a, league_b])
    await db_session.commit()
    await db_session.refresh(league_a)
    await db_session.refresh(league_b)

    # Teams in League A
    team_a1 = Team(league_id=league_a.id, name="AL Team 1", scoresheet_id=1)
    team_a2 = Team(league_id=league_a.id, name="AL Team 2", scoresheet_id=2)
    team_a3 = Team(league_id=league_a.id, name="AL Team 3", scoresheet_id=3)
    # Teams in League B
    team_b1 = Team(league_id=league_b.id, name="NL Team 1", scoresheet_id=1)
    team_b2 = Team(league_id=league_b.id, name="NL Team 2", scoresheet_id=2)
    team_b3 = Team(league_id=league_b.id, name="NL Team 3", scoresheet_id=3)
    db_session.add_all([team_a1, team_a2, team_a3, team_b1, team_b2, team_b3])
    await db_session.commit()
    for t in [team_a1, team_a2, team_a3, team_b1, team_b2, team_b3]:
        await db_session.refresh(t)

    # Users
    user1 = User(email="user1@test.com", role="user")
    user2 = User(email="user2@test.com", role="user")
    db_session.add_all([user1, user2])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)

    # Associations: user1 → A1, user2 → A2 + B1
    ut_u1_a1 = UserTeam(user_id=user1.id, team_id=team_a1.id, role="owner")
    ut_u2_a2 = UserTeam(user_id=user2.id, team_id=team_a2.id, role="owner")
    ut_u2_b1 = UserTeam(user_id=user2.id, team_id=team_b1.id, role="owner")
    db_session.add_all([ut_u1_a1, ut_u2_a2, ut_u2_b1])
    await db_session.commit()

    return {
        "league_a": league_a,
        "league_b": league_b,
        "team_a1": team_a1,
        "team_a2": team_a2,
        "team_a3": team_a3,
        "team_b1": team_b1,
        "team_b2": team_b2,
        "team_b3": team_b3,
        "user1": user1,
        "user2": user2,
    }
