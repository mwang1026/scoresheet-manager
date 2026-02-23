import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints.draft_queue import router as draft_queue_router
from app.api.endpoints.health import router as health_router
from app.api.endpoints.players import router as players_router
from app.api.endpoints.projections import router as projections_router
from app.api.endpoints.scoresheet import router as scoresheet_router
from app.api.endpoints.stats import router as stats_router
from app.api.endpoints.teams import router as teams_router
from app.api.endpoints.watchlist import router as watchlist_router
from app.config import settings
from app.services.scoresheet_scraper import refresh_league_cache

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Populate in-memory caches at startup."""
    try:
        leagues = await refresh_league_cache()
        logger.info("Startup: loaded %d leagues into cache", len(leagues))
    except Exception as e:
        logger.warning("Startup: failed to load league cache: %s", e)
    yield


app = FastAPI(title="Scoresheet Manager API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(players_router)
app.include_router(projections_router)
app.include_router(stats_router)
app.include_router(teams_router)
app.include_router(watchlist_router)
app.include_router(draft_queue_router)
app.include_router(scoresheet_router)
