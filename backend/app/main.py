from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints.health import router as health_router
from app.api.endpoints.players import router as players_router
from app.api.endpoints.projections import router as projections_router
from app.api.endpoints.stats import router as stats_router
from app.api.endpoints.teams import router as teams_router
from app.config import settings

app = FastAPI(title="Scoresheet Manager API", version="0.1.0")

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
