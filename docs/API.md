# API Contracts - Scoresheet Manager

## Architecture

**Frontend:** Next.js → **Backend:** FastAPI (Python)

- All endpoints require `X-Internal-API-Key` header (except `/api/health`). JWT auth is planned but not yet implemented — see `docs/SECURITY.md`.
- RESTful design, JSON payloads
- Internal network only (not public)

---

## Authentication

**Current implementation — internal API key + team context:**
```
X-Internal-API-Key: <value>   # required on all endpoints except /api/health
X-Team-Id: <integer>          # optional; falls back to DEFAULT_TEAM_ID env var
```

`X-Internal-API-Key` enforcement is skipped in dev when `INTERNAL_API_KEY` env var is empty (the default). See `docs/SECURITY.md` for full middleware behaviour.

**Planned:** JWT Bearer auth (`Authorization: Bearer <token>`) with per-user ACL.

---

## Response Format

**Success:**
```json
{
  "data": { ... }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid player ID"
  }
}
```

**Pagination:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 1500
  }
}
```

---

## Core Endpoints

### Health
```
GET /api/health
```
No auth. Returns service status.

---

### Players

**Get all players:**
```
GET /api/players?position=SS&status=available&page=1
```

**Query params:**
- `position` (optional): SS, 2B, OF, SP, RP, etc.
- `team` (optional): NYY, BOS, etc.
- `status` (optional): available, rostered, my_team, trade_bait
- `page`, `page_size` (pagination)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Bobby Witt Jr",
      "mlb_id": "7039739",
      "positions": [
        {"position": "SS", "rating": 3.5},
        {"position": "2B", "rating": 2.8}
      ],
      "current_team": "KC",
      "status": "rostered",
      "rostered_by": "Team Mike",
      "trade_bait": false
    }
  ],
  "pagination": {...}
}
```

---

**Get single player:**
```
GET /api/players/{player_id}
```

**Response:** Same as above, single object.

---

### Stats

**Get player stats (date range):**
```
GET /api/players/{player_id}/stats?start=2025-02-01&end=2025-02-14&type=hitter
```

**Query params:**
- `start`, `end` (ISO dates)
- `type`: hitter or pitcher

**Response:**
```json
{
  "data": {
    "player_id": "uuid",
    "type": "hitter",
    "period": {
      "start": "2025-02-01",
      "end": "2025-02-14"
    },
    "stats": {
      "pa": 56,
      "ab": 50,
      "h": 15,
      "doubles": 3,
      "triples": 1,
      "hr": 2,
      "bb": 5,
      "so": 12,
      "sb": 1,
      "avg": 0.300,
      "obp": 0.357,
      "slg": 0.480,
      "ops": 0.837
    }
  }
}
```

**Note:** AVG, OPS, etc. calculated on query, NOT stored in DB.

---

**Get player heatmap:**
```
GET /api/players/{player_id}/heatmap?weeks=10
```

**Response:**
```json
{
  "data": {
    "player_id": "uuid",
    "weeks": [
      {
        "week_start": "2025-01-06",
        "heat_level": "hot",
        "stats": {
          "pa": 25,
          "ops": 0.950
        }
      },
      {
        "week_start": "2025-01-13",
        "heat_level": "warm",
        "stats": {
          "pa": 22,
          "ops": 0.820
        }
      }
    ]
  }
}
```

---

**Get my team stats:**
```
GET /api/teams/me/stats?start=2025-02-01&end=2025-02-14
```

**Response:**
```json
{
  "data": {
    "team_id": "uuid",
    "team_name": "Team Mike",
    "hitters": {
      "pa": 245,
      "avg": 0.265,
      "ops": 0.750,
      "hr": 8,
      "sb": 4
    },
    "pitchers": {
      "ip": 52.1,
      "era": 4.20,
      "whip": 1.35,
      "k_per_9": 9.2
    }
  }
}
```

---

### Watchlist

**Get my watchlist:**
```
GET /api/watchlist
```

**Response:**
```json
{
  "data": [
    {
      "player_id": "uuid",
      "player_name": "Ezequiel Tovar",
      "added_at": "2025-02-10T14:30:00Z",
      "notes": "Hot streak, check Friday"
    }
  ]
}
```

---

**Add to watchlist:**
```
POST /api/watchlist
Body: { "player_id": "uuid", "notes": "..." }
```

---

**Remove from watchlist:**
```
DELETE /api/watchlist/{player_id}
```

---

### Draft

**Get my queue:**
```
GET /api/draft/queue
```

**Response:**
```json
{
  "data": [
    {
      "rank": 1,
      "player_id": "uuid",
      "player_name": "Bobby Witt Jr",
      "notes": "Top SS"
    },
    {
      "rank": 2,
      "player_id": "uuid",
      "player_name": "Gunnar Henderson",
      "notes": ""
    }
  ]
}
```

---

**Reorder queue:**
```
PUT /api/draft/queue
Body: [
  {"player_id": "uuid", "rank": 1},
  {"player_id": "uuid", "rank": 2}
]
```

---

**Get draft board:**
```
GET /api/draft/board?page=1
```

**Response:**
```json
{
  "data": [
    {
      "pick_number": 1,
      "round": 1,
      "team_id": "uuid",
      "team_name": "Team A",
      "player_id": "uuid",
      "player_name": "Bobby Witt Jr",
      "picked_at": "2025-02-15T09:01:23Z"
    }
  ],
  "pagination": {...}
}
```

---

### Projections

**Get player projections:**
```
GET /api/players/{player_id}/projections?source=steamer
```

**Query params:**
- `source`: steamer, zips, thebat

**Response:**
```json
{
  "data": {
    "player_id": "uuid",
    "source": "steamer",
    "type": "hitter",
    "projections": {
      "pa": 600,
      "hr": 30,
      "sb": 20,
      "avg": 0.280,
      "ops": 0.850
    }
  }
}
```

---

### Data Import

**Import players (CSV/HTML):**
```
POST /api/import/players
Body: { "content": "...", "format": "csv" }
```

**Import projections:**
```
POST /api/import/projections
Body: { "content": "...", "source": "steamer" }
```

---

## External APIs (Backend Consumes)

### MLB Stats API
**Base URL:** `https://statsapi.mlb.com/api/v1`

**Used for:**
- Daily stats scraping
- Player info
- Team info

**Example:**
```
GET /people/{mlb_id}
GET /people/{mlb_id}/stats?stats=season&season=2025
```

---

### Scoresheet (Scraping)
**Not an API — HTML/JS scraping via regex (no eval)**

**External URLs scraped:**
- League list: `{SCORESHEET_BASE_URL}/BB_LeagueList.php`
- Team owner data: `{SCORESHEET_BASE_URL}/{data_path}.js`

**Internal endpoints (backend exposes these):**
- `GET /api/scoresheet/leagues` — cached league list, instant
- `POST /api/scoresheet/leagues/refresh` — re-scrapes league list, rate-limited 2/min
- `GET /api/scoresheet/leagues/{data_path}/teams` — live scrape of one league, rate-limited 10/min

**Security & scraper patterns:** see `docs/SECURITY.md#scoresheet-scraper`

---

## Implementation Notes

**Backend (FastAPI):**
- Use Pydantic models for validation
- SQLAlchemy for database queries
- Calculate stats on query (never store AVG, OPS, ERA)
- Cache frequently accessed data (players list, team rosters)
- Rate limit external API calls (MLB Stats API)

**Frontend (Next.js):**
- Use SWR or React Query for data fetching
- Cache player data client-side
- Optimistic updates for watchlist, queue
- Handle loading/error states gracefully

**Performance:**
- Players list: <2 seconds (initial load with ~1,500 players)
- Player detail: <500ms
- Stats calculation: <100ms (single player, date range)
- My team stats: <200ms

**Security:**
- `X-Internal-API-Key` middleware on every request (except `/api/health`)
- CORS restricted to `CORS_ORIGINS` env var
- Rate limiting via slowapi on scraper endpoints
- Sanitize all inputs (SQL injection, XSS)
- Full details: `docs/SECURITY.md`

**Error Handling:**
- Return consistent error format
- Log errors with request ID
- Graceful degradation if MLB API down (show cached data)
