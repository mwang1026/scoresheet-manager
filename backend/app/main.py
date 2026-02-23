# DEPLOY: On Render, run the FastAPI backend as a Private Service
# (not publicly accessible). The Next.js frontend proxies to it via BACKEND_URL.
# See: https://docs.render.com/private-services
#
# DEPLOY: The lifespan hook below scrapes scoresheet.com on every process start.
# With multiple workers (gunicorn -w N), each worker will scrape independently.
# If this becomes a problem, move cache population to a /readiness endpoint
# or a one-time startup script.
#
# DEPLOY: For egress control, set HTTPS_PROXY env var on Render.
# httpx respects standard proxy env vars automatically.
# Consider Fixie or QuotaGuard for a managed egress proxy.

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.endpoints.draft_queue import router as draft_queue_router
from app.api.endpoints.health import router as health_router
from app.api.endpoints.players import router as players_router
from app.api.endpoints.projections import router as projections_router
from app.api.endpoints.scoresheet import limiter as scoresheet_limiter
from app.api.endpoints.scoresheet import router as scoresheet_router
from app.api.endpoints.stats import router as stats_router
from app.api.endpoints.teams import me_router, router as teams_router
from app.api.endpoints.watchlist import router as watchlist_router
from app.config import settings
from app.middleware.api_key import APIKeyMiddleware
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

# Rate limiter — keyed by remote address via SlowAPIMiddleware.
app.state.limiter = scoresheet_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware stack (last added = outermost = runs first on request):
#   APIKeyMiddleware → SlowAPIMiddleware → CORSMiddleware → route handler
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(APIKeyMiddleware)

app.include_router(health_router, prefix="/api")
app.include_router(players_router)
app.include_router(projections_router)
app.include_router(stats_router)
app.include_router(teams_router)
app.include_router(me_router)
app.include_router(watchlist_router)
app.include_router(draft_queue_router)
app.include_router(scoresheet_router)
