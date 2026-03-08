"""Request logging middleware with request ID correlation.

Generates a unique request ID per request, times the request, and logs
the method, path, status code, and duration. Sets X-Request-ID response header.
"""

import logging
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.logging_config import request_id_var

logger = logging.getLogger(__name__)

_HEALTH_PATH = "/api/health"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = uuid4().hex[:12]
        token = request_id_var.set(request_id)
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "%s %s -> 500 (%.0fms) [unhandled exception]",
                request.method,
                request.url.path,
                duration_ms,
                exc_info=True,
            )
            raise
        else:
            duration_ms = (time.perf_counter() - start) * 1000
            response.headers["X-Request-ID"] = request_id

            # Skip logging for health checks (Render polls frequently)
            if request.url.path != _HEALTH_PATH:
                status = response.status_code
                if status >= 500:
                    log_level = logging.ERROR
                elif status >= 400:
                    log_level = logging.WARNING
                else:
                    log_level = logging.DEBUG

                logger.log(
                    log_level,
                    "%s %s -> %d (%.0fms)",
                    request.method,
                    request.url.path,
                    status,
                    duration_ms,
                )

            return response
        finally:
            request_id_var.reset(token)
