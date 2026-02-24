# Security & Scraper Patterns

Implementation-accurate reference for the backend's auth, CORS, rate limiting, and external-fetch patterns.

---

## Auth Model

### User Authentication (Auth.js v5 + Google OAuth)

Authentication uses **Auth.js v5** (`next-auth@beta`) on the frontend with Google as the only provider.

**Frontend setup** (`frontend/auth.ts`, `frontend/middleware.ts`):
- JWT session strategy, 30-day `maxAge`
- `signIn` callback calls `POST /api/auth/check-email` on the backend to verify the user's email is in the `users` table (allowlist). If not found → sign-in is rejected.
- Login page: `frontend/app/login/page.tsx` (outside the `(app)/` route group — no sidebar)
- All authenticated pages live under `frontend/app/(app)/`

**Session propagation to backend** (trusted-header pattern):
Next.js `middleware.ts` decrypts the Auth.js JWE session token and injects:
```
X-User-Email: user@example.com
```
The backend reads this header to identify the current user — it does not decrypt JWT tokens directly.

**Backend user dependency** (`backend/app/api/dependencies.py`):

```python
async def get_current_user(db, x_user_email) -> User:
    # Production: looks up User by X-User-Email header
    # Dev bypass: AUTH_SECRET="" → finds user via DEFAULT_TEAM_ID (same as APIKeyMiddleware bypass)
```

Dev mode (empty `AUTH_SECRET`): no header needed — falls back to the user associated with `DEFAULT_TEAM_ID` via `user_teams`.

**Email allowlist endpoint** (`POST /api/auth/check-email`):
- Accepts `{ "email": "..." }`
- Queries `users` table
- Returns `{ "allowed": true/false }`
- Protected by `X-Internal-API-Key` at the service level

### Internal API Key (`X-Internal-API-Key`)

All requests (except `/api/health`) must include:
```
X-Internal-API-Key: <value>
```

Behaviour (see `backend/app/middleware/api_key.py`):
- `INTERNAL_API_KEY` is **empty by default** → enforcement is skipped entirely in dev.
- `/api/health` is always exempt (Render health checks don't send the header).
- Any other request with a missing or wrong key → `401 {"detail": "Invalid or missing API key"}`.

Set `INTERNAL_API_KEY` to a strong random value in production. The Next.js middleware injects it automatically into all `/api/*` proxy requests (except `/api/auth/*`).

### Team Context (`X-Team-Id`)

Endpoints that are team-scoped read the active team from:
```
X-Team-Id: <integer team id>
```

If the header is absent, the backend falls back to `settings.DEFAULT_TEAM_ID` (env var, defaults to `1`). This keeps dev ergonomic without extra headers.

---

## CORS

Configured via `CORS_ORIGINS` env var (comma-separated list). Default: `http://localhost:3000`.

```python
# config.py
CORS_ORIGINS: str = "http://localhost:3000"

@property
def cors_origins_list(self) -> list[str]:
    return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
```

On Render: set `CORS_ORIGINS=https://your-frontend.onrender.com`.

`allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]` — tighten in production if needed.

---

## Rate Limiting

Uses `slowapi` (thin wrapper around `limits`), keyed by remote IP via `get_remote_address`.

| Endpoint | Limit | Reason |
|---|---|---|
| `POST /api/scoresheet/leagues/refresh` | 2/minute | Each call triggers outbound scrape to scoresheet.com |
| `GET /api/scoresheet/leagues/{data_path}/teams` | 10/minute | Each call makes outbound HTTP request to scoresheet.com |

Rate-limit responses: `429 Too Many Requests` (handled by `_rate_limit_exceeded_handler`).

---

## Middleware Stack

Added in reverse order (last added = outermost = runs first on request):

```
Request →  APIKeyMiddleware  →  SlowAPIMiddleware  →  CORSMiddleware  →  route handler
```

Source: `backend/app/main.py` lines 56–66.

---

## Scoresheet Scraper

Source: `backend/app/services/scoresheet_scraper.py`

**JS parsing — no eval, regex only.**
League data files are JavaScript but parsed exclusively with compiled regexes. No `eval()`/`exec()` is used anywhere.

**Path traversal prevention.**
The `data_path` parameter (used to build the JS file URL) is validated against `^[A-Za-z0-9_]+/[A-Za-z0-9_]+$` before any fetch. Anything that doesn't match → `ValueError` → HTTP 400.

**Concurrency control.**
An `asyncio.Lock` (`_scrape_lock`) ensures only one outbound scrape runs at a time, preventing thundering-herd hammering of scoresheet.com when multiple requests arrive simultaneously.

**Timeout.**
All outbound requests use a 15-second timeout (`REQUEST_TIMEOUT = 15.0`).

**Configurable base URL.**
`SCORESHEET_BASE_URL` env var (default `https://www.scoresheet.com`). Override to route through an egress proxy or test server.

**URLs scraped:**
- League list: `{SCORESHEET_BASE_URL}/BB_LeagueList.php`
- Team data: `{SCORESHEET_BASE_URL}/{data_path}.js`

**Internal endpoints:**
- `GET /api/scoresheet/leagues` — returns cached league list (no I/O, instant)
- `POST /api/scoresheet/leagues/refresh` — re-scrapes BB_LeagueList.php, rate-limited 2/min
- `GET /api/scoresheet/leagues/{data_path}/teams` — live scrape of one league's team JS, rate-limited 10/min

**Error mapping:**
- `ValueError` (bad `data_path`) → 400
- `httpx.HTTPStatusError` or `httpx.RequestError` (upstream failure) → 502

---

## MLB Stats API

Source: `backend/app/services/mlb_stats_api.py`

**Rate limiting.** 75ms inter-request delay (`RATE_LIMIT_DELAY = 0.075`) between sequential player fetches, ~13 req/sec sustained.

**Timeout.** 10-second request timeout (`REQUEST_TIMEOUT = 10.0`).

**Dedup cache.** Two-way players (who appear in both hitting and pitching) are cached by `(mlb_id, group)` to avoid redundant API calls within a single daily-stats run.

**Graceful failure.** Any `HTTPStatusError` or `RequestError` logs a warning and returns `None` — the daily sync continues rather than aborting the entire run.

**Configurable base URL.** `MLB_API_BASE_URL` env var (default `https://statsapi.mlb.com/api/v1`).

---

## Planned (not yet implemented)

Per-user ACL enforcement on team endpoints, admin-only scraper refresh trigger.

---

## New Endpoint Checklist

Before shipping a new backend endpoint:

1. Does it need API key auth? (Almost always yes — only `/api/health` is exempt.)
2. Does it make outbound HTTP calls? If so, add a `@limiter.limit(...)` decorator.
3. Does it accept a user-supplied path or identifier? Validate against an allowlist regex.
4. Is it team-scoped? Read `X-Team-Id` header with `DEFAULT_TEAM_ID` fallback.
5. Does it trigger expensive operations (scrape, bulk import)? Rate-limit and return 502 on upstream failure.
