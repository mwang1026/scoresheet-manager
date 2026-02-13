# Scoresheet Manager - Claude Code Guide

## What This Project Is

A fantasy baseball management tool for a 10-team Scoresheet league. Helps users track stats, find hot/cold players, manage drafts, and monitor their roster. Think Bloomberg terminal for fantasy baseball, not ESPN gamecast.

**Core Philosophy:** Functional > Decorative. High information density, fast decisions, minimal friction.

**Tech Stack:** Next.js 14 (App Router) + TypeScript frontend, FastAPI + PostgreSQL backend, deployed on Render. See `docs/STACK.md` for full details.

---

## Task-Based Documentation Map

**Before starting ANY task, read the relevant docs below:**

### UI/Frontend Work
**Read first:** `docs/DESIGN.md`
- Building any page or component
- Styling decisions
- Layout/responsive behavior
- Color/typography choices

**Core Principle:** Tables are king. Compact, scannable, tabular numbers. Avoid card-heavy layouts.

### Database/Backend Work
**Read first:** `docs/DATABASE.md`
- Schema design
- Table creation
- Query optimization
- Data modeling

**Critical Rule:** Store raw stats only (PA, AB, H, BB). NEVER store calculated stats (AVG, OPS, ERA). Calculate on query.

### Feature Implementation
**Read first:** `docs/FEATURES.md` + `docs/PAGES.md`
- Understanding what to build
- Feature requirements
- Page structure and content

**Then check:** `docs/FLOWS.md` for user journey context

### API Integration
**Read first:** `docs/API.md`
- External API contracts (MLB Stats API, etc.)
- Scraping requirements
- Data sync patterns

### Tech Stack Decisions
**Read first:** `docs/STACK.md`
- Framework choices
- Library recommendations
- Deployment setup

---

## Quick Reference

### Key Stats Formulas (Calculate on Query)

**Hitters:**
- AVG = H / AB
- OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
- SLG = (1B + 2×2B + 3×3B + 4×HR) / AB
- OPS = OBP + SLG

**Pitchers:**
- ERA = (ER / IP) × 9
- WHIP = (H + BB) / IP
- K/9 = (K / IP) × 9
- IP from outs: IP = outs / 3 (e.g., 16 outs = 5.1 IP)

### Hot/Cold Thresholds (for Weekly Heatmap)

**Hitters (min 20 PA/week):**
- Hot: OPS >= 0.900
- Warm: OPS 0.700-0.899
- Neutral: OPS 0.500-0.699
- Cold: OPS < 0.500

**Starting Pitchers (min 1 GS/week):**
- Hot: ERA <= 2.50
- Warm: ERA 2.51-4.00
- Neutral: ERA 4.01-5.00
- Cold: ERA > 5.00

**Relief Pitchers (min 1 G, 0 GS/week):**
- Hot: ERA <= 1.00
- Warm: ERA 1.01-2.50
- Neutral: ERA 2.51-4.00
- Cold: ERA > 4.00

---

## Core Pages (Priority Order)

1. **Dashboard** - Daily check-in hub (team stats, heatmaps, news)
2. **Players** - Main browsing/filtering table with stats and heatmaps
3. **Player Detail** - Deep dive: full stats, news, projections, history
4. **Draft** - Queue management, projections, live draft board
5. **Opponents** - League-wide team grid and stats
6. **Settings** - Data import, league config, user prefs

---

## Common Pitfalls to Avoid

### Database
- Do not store AVG, OPS, ERA in database
- Do not combine hitters and pitchers in one table
- Do not forget indexes on (player_id, date)
- Do not use DECIMAL for innings pitched (use outs as INT)

### UI/Design
- Do not use cards for everything (use tables!)
- Do not use excessive whitespace/padding
- Do not create rainbow dashboards (strategic color only)
- Do not forget tabular-nums for stat columns
- Do not use heavy borders/shadows on tables

### Features
- Do not auto-pick draft choices (user picks manually)
- Do not auto-add players to roster (user decides)
- Do not build trade negotiation features (out of scope)
- Do not build real-time live updates during games (daily updates only)

---

## Data Flow Overview

### Inbound (Daily)
1. **Cron job** triggers daily at 6am PT
2. **MLB Stats API** scraped for previous day's stats (all ~1,500 players)
3. **Raw stats** saved to hitter_daily_stats / pitcher_daily_stats tables
4. **Weekly heat** materialized view refreshed (calculates hot/cold)

### Outbound (User Queries)
1. User requests stats for date range
2. Backend **aggregates raw stats** (SUM across dates)
3. Backend **calculates** AVG, OPS, ERA, etc. on the fly
4. Frontend displays results

**Never cache calculated stats in database.**

---

## Non-Negotiable Rules

1. **Never store calculated stats** (AVG, OPS, ERA) in database
2. **Tables are the primary UI pattern** (not cards)
3. **Tabular numerals** (monospaced) for all stat columns
4. **Daily granularity only** (no intra-day updates)
5. **Users make all roster decisions** (no auto-adds)
6. **Functional over decorative** (every pixel serves a purpose)

---

## Documentation

All detailed docs live in `/docs/`:

| File | Purpose |
|------|---------|
| `docs/DESIGN.md` | UI/UX principles, component guidelines |
| `docs/DATABASE.md` | Schema requirements, query patterns |
| `docs/FEATURES.md` | Feature list with requirements |
| `docs/PAGES.md` | Page-by-page content spec |
| `docs/FLOWS.md` | User journey examples |
| `docs/API.md` | External API contracts |
| `docs/STACK.md` | Tech stack decisions |

---

## Working with Claude Code

### When Starting a New Task

1. **Identify task type** (UI, database, feature, API)
2. **Read relevant docs** from map above (usually 1-2 files)
3. **Check Quick Reference** for formulas/thresholds
4. **Avoid pitfalls** listed above
5. **Build iteratively** (make it work, then make it good)

### When Making Decisions

**Prioritize:**
1. Speed (fast queries, fast rendering)
2. Clarity (obvious information hierarchy)
3. Density (more info, less scrolling)
4. Simplicity (fewer features done well)

**Ask yourself:**
- Does this help users make faster decisions?
- Is this the minimal solution that works?
- Am I storing raw data or calculated stats? (must be raw!)
- Does this match the "Bloomberg terminal" vibe?

---

## Precedence

1. This file (CLAUDE.md) takes precedence for high-level principles
2. Specific docs (DESIGN.md, DATABASE.md, etc.) take precedence for details
3. When in doubt: prioritize user speed and data correctness
