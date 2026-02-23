"""
Internal API key middleware.

Validates the X-Internal-API-Key header on every request.
- If INTERNAL_API_KEY is empty (default in dev), validation is skipped entirely.
- /api/health is always exempt (Render health checks don't send the header).
- All other requests without a valid key receive 401.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

_HEALTH_PATH = "/api/health"


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Dev mode: API key enforcement disabled when key is not configured.
        if not settings.INTERNAL_API_KEY:
            return await call_next(request)

        # Render health checks must always pass.
        if request.url.path == _HEALTH_PATH:
            return await call_next(request)

        api_key = request.headers.get("X-Internal-API-Key", "")
        if api_key != settings.INTERNAL_API_KEY:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key"},
            )

        return await call_next(request)
