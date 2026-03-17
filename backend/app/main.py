# DEPLOY: No public domain generated on Railway; reachable via *.railway.internal.
# The Next.js frontend proxies to it via BACKEND_URL.
#
# DEPLOY: The lifespan hook below scrapes scoresheet.com on every process start.
# With multiple workers, each worker will scrape independently.
# If this becomes a problem, move cache population to a /readiness endpoint
# or a one-time startup script.

# Configure logging before any other app imports so all loggers inherit the config.
from app.logging_config import setup_logging  # noqa: E402

setup_logging()

import logging  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

import posthog  # noqa: E402

# Disable PostHog by default; enabled in lifespan when POSTHOG_API_KEY is set.
# A placeholder api_key is required so that setup() doesn't raise ValueError before
# the disabled flag is checked.
posthog.api_key = "disabled"
posthog.disabled = True

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402
from slowapi.middleware import SlowAPIMiddleware  # noqa: E402

from app.api.endpoints.auth import router as auth_router  # noqa: E402
from app.api.endpoints.custom_positions import router as custom_positions_router  # noqa: E402
from app.api.endpoints.draft import router as draft_router  # noqa: E402
from app.api.endpoints.draft_notes import router as draft_notes_router  # noqa: E402
from app.api.endpoints.draft_queue import router as draft_queue_router  # noqa: E402
from app.api.endpoints.player_notes import router as player_notes_router  # noqa: E402
from app.api.endpoints.health import router as health_router  # noqa: E402
from app.api.endpoints.news import router as news_router  # noqa: E402
from app.api.endpoints.players import router as players_router  # noqa: E402
from app.api.endpoints.projections import router as projections_router  # noqa: E402
from app.api.endpoints.scoresheet import limiter as scoresheet_limiter  # noqa: E402
from app.api.endpoints.scoresheet import router as scoresheet_router  # noqa: E402
from app.api.endpoints.stats import router as stats_router  # noqa: E402
from app.api.endpoints.teams import me_router, router as teams_router  # noqa: E402
from app.api.endpoints.user_settings import router as user_settings_router  # noqa: E402
from app.api.endpoints.watchlist import router as watchlist_router  # noqa: E402
from app.config import settings  # noqa: E402
from app.middleware.api_key import APIKeyMiddleware  # noqa: E402
from app.middleware.request_logging import RequestLoggingMiddleware  # noqa: E402
from app.services.scoresheet_scraper import refresh_league_cache  # noqa: E402

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Populate in-memory caches at startup."""
    # Initialize PostHog
    if not settings.POSTHOG_DISABLED and settings.POSTHOG_API_KEY:
        posthog.api_key = settings.POSTHOG_API_KEY
        posthog.host = settings.POSTHOG_HOST
        posthog.disabled = False
        logger.info("Startup: PostHog analytics enabled")

    try:
        leagues = await refresh_league_cache()
        logger.info("Startup: loaded %d leagues into cache", len(leagues))
    except Exception as e:
        logger.warning("Startup: failed to load league cache: %s", e)
    yield

    # Flush PostHog events on shutdown
    if not settings.POSTHOG_DISABLED and settings.POSTHOG_API_KEY:
        posthog.flush()


app = FastAPI(title="Scoresheet Manager API", version="0.1.0", lifespan=lifespan)

# Rate limiter — keyed by remote address via SlowAPIMiddleware.
app.state.limiter = scoresheet_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware stack (last added = outermost = runs first on request):
#   RequestLoggingMiddleware → APIKeyMiddleware → SlowAPIMiddleware → CORSMiddleware → route
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(APIKeyMiddleware)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(auth_router)
app.include_router(custom_positions_router)
app.include_router(health_router, prefix="/api")
app.include_router(news_router)
app.include_router(players_router)
app.include_router(player_notes_router)
app.include_router(projections_router)
app.include_router(stats_router)
app.include_router(teams_router)
app.include_router(me_router)
app.include_router(user_settings_router)
app.include_router(watchlist_router)
app.include_router(draft_router)
app.include_router(draft_notes_router)
app.include_router(draft_queue_router)
app.include_router(scoresheet_router)
