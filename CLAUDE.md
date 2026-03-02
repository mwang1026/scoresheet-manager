# Scoresheet Manager — Claude Code Guide

## What This Project Is
Fantasy baseball management tool for a 10-team Scoresheet league. Bloomberg terminal for fantasy baseball — functional, dense, fast.
Tech: Next.js 14 (App Router) + TypeScript, FastAPI + PostgreSQL, deployed on Railway.

## Coding Principles
- **DRY aggressively** — same constant/type/logic in 2+ files? Centralize it. Flag repetition early.
- **Test thoroughly** — too many tests > too few. Cover exports, endpoints, invariants, and prop threading across layers.
- **Engineered enough** — not hacky/fragile, not over-abstracted. Handle edge cases; skip hypothetical futures.
- **Thoughtfulness > speed** — think through failure modes before shipping.
- **Explicit > clever** — readable beats terse. Make data flow traceable.

## Architecture Review (During Planning)
Before writing code, evaluate:
- **System design & component boundaries** — is responsibility clearly divided? Are components doing too much?
- **Dependency graph & coupling** — are modules loosely coupled? Would this change create tight coupling or circular dependencies?
- **Data flow** — trace data from source to consumer across every layer. Verify nothing is dropped at intermediate hops.
- **Security boundaries** — auth, data access controls, API surface. Does this change affect who can access what?
- **Reuse** — search for existing utilities, components, and patterns before creating new ones.
- **Confirm requirements first** — before designing implementation, summarize functional requirements (what it does) and UX flow (how the user interacts with it) back to the user. Get explicit confirmation before planning how to build it.
- **Ask the user** when multiple valid approaches exist — don't assume.

## Code Quality (During Review)
When reviewing or writing code, check for:
- **Organization & structure** — files in the right place? Clear module boundaries? Consistent naming?
- **DRY violations** — duplicated types, constants, or logic across files. Centralize in shared modules (e.g., `frontend/lib/`).
- **Error handling & edge cases** — call out missing edge cases explicitly. Handle nulls, empty states, and boundary conditions.
- **Tech debt hotspots** — fragile code, workarounds, or patterns that will break as the codebase grows. Flag them.
- **Engineering calibration** — flag both under-engineering (no validation, no error handling, brittle assumptions) and over-engineering (abstractions nobody asked for, premature generalization).

## Non-Negotiable Rules
1. Never store calculated stats (AVG, OPS, ERA) in database — calculate on query
2. Tables are the primary UI pattern, not cards. Tabular numerals for all stat columns.
3. Daily granularity only — no intra-day updates
4. Users make all roster decisions — no auto-adds, no auto-picks
5. Always commit to a feature branch (`mw-{ticket}-short-description`), never to `main`
6. Run `npm test` and `npm run build` (frontend) and `pytest tests/ -v` (backend) before considering work complete

## Testing
- All exported functions and components must have tests
- All API endpoints must have integration tests
- Mock external services — never hit real APIs in tests
- Colocate test files: `*.test.ts(x)` next to source (frontend), `test_*.py` in `tests/` (backend)
- Frameworks: Vitest + React Testing Library (frontend), pytest + httpx (backend)
- **Mock at the IO boundary** — mock HTTP calls / network, not the functions that parse responses. Integration tests must exercise real parsing and transformation logic.
- **Fixtures from real data** — derive test fixtures from actual service responses, not hand-written to match current code. If a regex or parser changes, fixtures should break the test, not silently pass.
- **Test observability paths** — if code emits a warning or error log, test that the condition triggers and the log is emitted.

## Common Pitfalls
**Database:** Don't store calculated stats. Don't combine hitters/pitchers in one table. Use outs as INT for innings pitched.
**UI:** Don't use cards for everything. Don't forget `tabular-nums`. Don't use excessive whitespace or heavy borders.
**Features:** Don't auto-pick/auto-add. Don't build trade negotiation or real-time live updates.

## Documentation Map
Read the relevant doc before starting any task:
| Doc | When |
|-----|------|
| `docs/DESIGN.md` | UI/component work |
| `docs/DATABASE.md` | Schema/query work |
| `docs/FEATURES.md` + `docs/PAGES.md` | Feature implementation |
| `docs/API.md` + `docs/SECURITY.md` | API integration, auth |
| `docs/STACK.md` | Tech stack decisions |
| `docs/RAILWAY.md` | Railway deployment, Railpack gotchas, env vars, cron jobs |
| `docs/TEST.md` | Testing conventions |
| `docs/REFERENCE.md` | Stat formulas, hot/cold thresholds |

## Data Flow
**Inbound:** Daily cron → MLB Stats API → raw stats → hitter/pitcher_daily_stats tables → weekly heat materialized view.
**Outbound:** User query → backend aggregates raw stats → calculates AVG/OPS/ERA on the fly → frontend displays.
Never cache calculated stats.

## Dev Servers
Both must be running. Restart with cache clearing after modifying files:
**Frontend (port 3000):**
`lsof -ti:3000 | xargs kill -9 2>/dev/null; cd frontend && rm -rf .next && npm run dev`
**Backend (port 8000):**
`lsof -ti:8000 | xargs kill -9 2>/dev/null; cd backend && source .venv/bin/activate && uvicorn app.main:app --reload`
If Next.js proxy returns 404: run the frontend restart command above.

## Precedence
1. This file for high-level principles
2. Specific docs for details
3. When in doubt: user speed and data correctness
