# Features - Scoresheet Manager

## MVP Scope (Phase 1)

### Authentication
- Google OAuth login (NextAuth.js)
- Email allowlist (users table)
- User-to-team mapping
- 30-day sessions

### Core Data
**Database:**
- Players, Teams, Positions
- Hitter/Pitcher daily stats (raw only)
- Player Roster (ownership)
- Weekly Heat materialized view

**Manual Import (Settings page):**
- Player list (CSV/HTML from Scoresheet)
- Team rosters (HTML from Scoresheet)
- Projections (Steamer/ZiPS CSV)
- Draft order (HTML from Scoresheet)

### Players Page
**Table view with:**
- All players, sortable by any stat column
- Filters: Position, Team, Status (Available/Rostered/Trade Bait)
- Search by name
- Toggle: Stats View vs Hotness View (10-week heatmap)
- Click row → Player Detail page

**Stats calculated on query** (never stored):
- Hitters: AVG, OBP, SLG, OPS
- Pitchers: ERA, WHIP, K/9, BB/9

### Player Detail Page
**Sections:**
- Header: Name, positions, team, ownership status
- Stats table: Week-to-date, Last 7, Last 14, Last 30, Season
- 10-week heatmap (hot/cold performance)
- News summary (LLM-generated from articles)
- Projections comparison (toggle source)
- Actions: Watchlist toggle, Trade bait toggle, Add to queue

### Dashboard
**My Team focus:**
- Week-to-date team stats (hitting, pitching)
- Heatmap: My Team (rostered players only)
- Heatmap: Watchlist (players I'm monitoring)
- Recent news (last 48 hours, all players)

### Draft Page
**Three tabs:**

1. **Projections Tab**
   - All available players
   - Select projection source (Steamer, ZiPS, etc.)
   - Sort by projected stat
   - Add to queue button

2. **My Queue Tab**
   - User's draft preferences
   - Drag-drop reorder
   - Remove button
   - Auto-removes drafted players

3. **Draft Board Tab**
   - Pick-by-pick history (scraped from Scoresheet)
   - Shows: Pick #, Team, Player, Timestamp
   - Filters: By team, by round
   - Auto-updates when picks scraped

### Watchlist
- Add/remove players to personal watchlist
- Watchlist heatmap on Dashboard
- Quick access from any player view

### Trade Bait
- Flag players as trade bait (personal notes)
- Filter Players page by trade bait
- See other teams' trade bait players

### Settings Page
**Data Import:**
- Player list upload
- Team roster import
- Projection CSV upload
- Draft order HTML paste

**League Config:**
- Scoring categories (display only for MVP)
- Team names (editable)

---

## Post-MVP Features (Future)

### Automated Scraping (Phase 2)
- Daily cron job: MLB Stats API → database
- Draft scraper: Poll Scoresheet during draft
- News scraper: Aggregate from CBS, BP, etc.
- LLM news summarization

### Advanced Filtering (Phase 2)
- Date range performance (e.g., "Show players hot in last 7 days")
- Multi-stat filters (PA > 50, OPS > .800)
- Saved filter presets

### Opponents Page (Phase 2)
- Grid view: All 10 teams
- Click team → Team Detail (roster, stats)
- Compare teams side-by-side

### Mobile Optimization (Phase 2)
- Responsive layouts for all pages
- Bottom nav bar (mobile)
- Simplified tables (horizontal scroll or card fallback)

### Multi-User Support (Phase 3)
- Multiple users per team
- Role-based permissions
- Shared watchlists (team-wide)

### Advanced Draft Features (Phase 3)
- Mock draft simulator
- Auction draft support
- Pick recommendation engine

---

## Out of Scope (Not Building)

- ❌ Auto-picking draft choices (user picks manually on Scoresheet)
- ❌ Auto-adding players to roster (user decides, executes on Scoresheet)
- ❌ Trade negotiation/messaging (handle outside app)
- ❌ Real-time live game updates (daily updates only)
- ❌ Custom league scoring (built for Scoresheet rules only)
- ❌ Mobile app (PWA web app only)

---

## Feature Dependencies

**Critical path for MVP:**
1. Auth → Database → Manual Import → Players Page → Player Detail
2. Players Page → Watchlist → Dashboard
3. Manual Import → Projections → Draft Page

**Can build in parallel:**
- Dashboard (depends on Players data)
- Draft Page (depends on Projections import)
- Settings Page (independent)

---

## Success Criteria (MVP Launch)

**Must have:**
- [ ] Login with allowlist enforcement
- [ ] Players page with sortable stats table
- [ ] Player Detail with stats + heatmap
- [ ] Dashboard with My Team stats + watchlist
- [ ] Draft page with queue + projections
- [ ] Settings page with CSV/HTML import tools
- [ ] Watchlist add/remove functionality
- [ ] Hot/cold heatmap working (10 weeks)

**Nice to have (can defer):**
- News scraping/summarization
- Opponents page
- Advanced date range filters
- Mobile-optimized layouts

**Performance targets:**
- Dashboard loads in <1 second
- Players page <2 seconds (initial load)
- Player Detail <500ms
- Stats calculations <100ms (single player, date range)

**The goal: Launch with core browsing, filtering, and draft support. Add automation and polish post-launch.**
