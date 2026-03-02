# Tech Stack

## Frontend
- **Next.js 14** (App Router) + TypeScript
- **TailwindCSS** + shadcn/ui components
- **SWR** for data fetching
- **NextAuth.js v5** (Google OAuth)

## Backend
- **FastAPI** (Python 3.11+)
- **PostgreSQL 15+**
- **SQLAlchemy 2.0** (async)

## Deployment
- **Railway** (Hobby plan, usage-billed)
  - Web Service: Next.js (public domain)
  - Private Service: FastAPI (internal networking only)
  - PostgreSQL (one-click, usage-billed)
  - Cron Services: daily MLB ingest, news, IL status, weekly roster/draft sync, draft monitor

## Data Sources
- MLB Stats API (`statsapi.mlb.com`)
- Scoresheet.com (HTML scraping)

## File Structure
```
/frontend
  /app (pages)
  /components
  /lib (API client, utils)

/backend
  /app
    /api/endpoints
    /models (SQLAlchemy)
    /schemas (Pydantic)
    /services
  /alembic (migrations)
```

## Environment Variables

**Frontend (.env.local)**
```
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<random>
AUTH_GOOGLE_ID=<id>
AUTH_GOOGLE_SECRET=<secret>
BACKEND_URL=http://localhost:8000
```

**Backend (.env)**
```
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
JWT_SECRET=<random>
MLB_API_BASE_URL=https://statsapi.mlb.com/api/v1
SCORESHEET_BASE_URL=https://www.scoresheet.com
CORS_ORIGINS=http://localhost:3000
INTERNAL_API_KEY=                  # empty = dev bypass; set a strong value in prod
DEFAULT_TEAM_ID=1
DEFAULT_LEAGUE_ID=1
SEED_LEAGUE_NAME=AL Catfish Hunter
SEED_LEAGUE_SEASON=2026
SEED_USERS=user@example.com:1:owner
```

## Key Dependencies

**Frontend:** next, react, typescript, tailwindcss, next-auth, swr

**Backend:** fastapi, uvicorn, sqlalchemy, asyncpg, psycopg, alembic, pydantic, pydantic-settings, beautifulsoup4, httpx, slowapi