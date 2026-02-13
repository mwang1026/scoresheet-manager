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
- **Render** (free tier)
  - Web Service: Next.js
  - Web Service: FastAPI (internal)
  - Managed PostgreSQL

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
NEXTAUTH_SECRET=<random>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
BACKEND_URL=http://localhost:8000
```

**Backend (.env)**
```
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
JWT_SECRET=<random>
MLB_API_BASE_URL=https://statsapi.mlb.com/api/v1
```

## Key Dependencies

**Frontend:** next, react, typescript, tailwindcss, next-auth, swr

**Backend:** fastapi, uvicorn, sqlalchemy, asyncpg, alembic, pydantic, pandas, beautifulsoup4, httpx