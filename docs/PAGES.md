# Pages - Scoresheet Manager

## Page Structure & Routes

### 🏠 Dashboard (`/`)
**Job:** Daily check-in, surface hot/cold trends, stay updated

**Sections:**
1. **Week-to-Date Team Stats**
   - My Team aggregates (hitters, pitchers)
   - Hitters: AVG, OBP, OPS, HR, SB, PA, BB
   - Pitchers: ERA, WHIP, K/9, BB/9, IP, G

2. **My Team Heatmap**
   - 10-week grid, all rostered players
   - Click square → Player Detail filtered to that week
   - Toggle: Show all positions vs position groups

3. **Watchlist Heatmap**
   - Same format, watchlist players only
   - Quick-add to watchlist from this view

4. **Recent News** (if implemented)
   - Last 48 hours, all players
   - Click headline → Player Detail

**Navigation:** Sidebar or top nav to Players, Draft, Opponents, Settings

---

### 📊 Players Page (`/players`)
**Job:** Browse, filter, compare players

**Main Table:**
- Columns: Name, Pos, Team, Status, PA, AB, H, AVG, OBP, SLG, OPS (hitters)
- Or: Name, Pos, Team, Status, G, GS, IP, ERA, WHIP, K/9 (pitchers)
- Sortable by any column
- Sticky header
- Row click → Player Detail

**Filters (left sidebar or top bar):**
- Search by name
- Position (multi-select)
- Team (multi-select)
- Status: All, Available, Rostered, My Team, Trade Bait
- Date range (Week-to-date, Last 7, Last 14, Last 30, Season, Custom)

**View Toggle:**
- **Stats View:** Traditional stat columns
- **Hotness View:** Replace stat columns with 10-week heatmap (inline)

**Actions:**
- Add to watchlist (⭐ icon in row)
- Click name → Player Detail

---

### 👤 Player Detail (`/players/[id]`)
**Job:** Deep dive on one player

**Header:**
- Name, positions (with defensive ratings), team
- Ownership status (Available, Rostered by Team X, My Team)

**Tabs or Sections:**

1. **Stats Table**
   - Rows: Week-to-date, Last 7, Last 14, Last 30, Season
   - Columns: Full stat line (PA, AB, H, AVG, OBP, SLG, OPS, HR, SB for hitters)
   - Calculated on query

2. **10-Week Heatmap**
   - Color-coded squares
   - Hover: Shows week stats
   - Click: Filters stats table to that week

3. **News Summary** (if implemented)
   - LLM-generated summary from recent articles
   - Source links
   - Timestamp

4. **Projections** (if implemented)
   - Toggle source (Steamer, ZiPS, THE BAT)
   - Compare projected vs actual stats

**Actions:**
- ⭐ Add/Remove Watchlist (toggle button)
- 📋 Add to Draft Queue (button)
- 🔄 Toggle Trade Bait (if owned by user's team)

---

### 🎯 Draft Page (`/draft`)
**Job:** Prepare draft queue, track live picks, compare projections

**Three Tabs:**

#### Tab 1: Projections
- Table: All available players
- Columns: Name, Pos, Team, Projected Stats (based on selected source)
- Filter by position, team
- Sort by projected stat
- "Add to Queue" button per row
- Toggle projection source dropdown (Steamer, ZiPS, etc.)

#### Tab 2: My Queue
- User's draft preferences (ordered list)
- Drag-drop to reorder
- Remove button
- Auto-removes players when drafted
- Notes field per player

#### Tab 3: Draft Board
- Pick history table
- Columns: Pick #, Round, Team, Player, Timestamp
- Filters: By team, by round
- Auto-updates when scraper runs
- Shows upcoming picks (from schedule)

**Implementation Note:** Draft picks happen manually on Scoresheet site. This page tracks picks after they're made.

---

### 🏆 Opponents Page (`/opponents`) - Post-MVP
**Job:** Compare teams, find trade opportunities

**Grid View:**
- 9 cards (all teams except user's)
- Each card: Team name, owner, key stats, record
- Click card → Team Detail

**Team Detail (`/opponents/[teamId]`):**
- Full roster table
- Aggregate team stats
- Trade bait filter (if they've flagged players)

---

### ⚙️ Settings Page (`/settings`)
**Job:** Import data, configure league, manage account

**Sections:**

1. **Data Import**
   - Player List: Upload CSV or paste HTML
   - Team Rosters: Paste HTML from Scoresheet
   - Projections: Upload CSV (Steamer, ZiPS)
   - Draft Order: Paste HTML from Scoresheet
   - Each has "Dry Run" preview before committing

2. **League Configuration**
   - Team names (editable)
   - Scoring categories (display only for MVP)
   - Season dates

3. **Account**
   - Email (read-only, from OAuth)
   - Logout button

---

### ⭐ Watchlist Page (`/watchlist`) - Optional
**Job:** Dedicated view for watchlist players

**Alternative:** Could be a filter on Players page instead of separate page

**If built as separate page:**
- Same table as Players page
- Only shows watchlist players
- Remove from watchlist button

---

## Navigation Structure

### Desktop
**Sidebar (left):**
- Dashboard
- Players
- Draft
- Opponents (future)
- Settings

**User menu (top-right):**
- Email
- Logout

### Mobile
**Bottom Nav Bar:**
- Dashboard (home icon)
- Players (list icon)
- Draft (target icon)
- More (hamburger → Settings, Opponents)

---

## Common UI Patterns

### Heatmap Grid
**Used on:** Dashboard, Players page (hotness view), Player Detail

**Structure:**
- Row per player
- Column per week (W1-W10)
- Color-coded squares: 🔥 Hot, 🟡 Warm, 🔵 Neutral, ❄️ Cold, ⚪ No data
- Hover: Tooltip with week stats
- Click: Navigate to Player Detail or filter to week

### Stat Table
**Used on:** Players page, Player Detail, My Team

**Requirements:**
- Sortable columns
- Sticky header
- Tabular numerals
- Right-aligned numbers
- Left-aligned text
- Alternating row background

### Filters
**Used on:** Players page, Draft Projections, Opponents

**Pattern:**
- Multi-select dropdowns or checkboxes
- Applied filters shown as chips (removable)
- "Clear All" button
- Filter count badge

---

## Page Load Priorities

**Critical (< 1 second):**
- Dashboard

**Important (< 2 seconds):**
- Players page (initial load)
- Player Detail

**Acceptable (< 5 seconds):**
- Draft page (has lots of data)
- Settings page imports

---

## Mobile Considerations

**Players Table:**
- Show fewer columns (Name, Pos, AVG/ERA, OPS/WHIP)
- Horizontal scroll for full stats
- Or: Switch to card view on <768px

**Heatmaps:**
- Show 5-6 weeks on mobile
- Horizontal scroll for more
- Larger touch targets (squares)

**Filters:**
- Collapse into drawer/modal
- "Filters (3)" button opens drawer

**Navigation:**
- Bottom nav bar (icons only)
- Hamburger menu for secondary pages

---

## Accessibility

**Required:**
- Semantic HTML (`<table>`, `<nav>`, `<main>`)
- Keyboard navigation (tab through all interactive elements)
- ARIA labels for icon buttons
- Focus indicators
- Color contrast WCAG AA
- Screen reader support (proper heading hierarchy)

**Don't rely on color alone:**
- Use icons + color for status (🔥 + red for hot)
- Use text labels + color for filters

---

## Example Page Wireframes (Conceptual)

### Dashboard
```
+------------------------------------------+
| Header: Scoresheet Manager    [User ▾]  |
+------------------------------------------+
| Sidebar |                                |
| - Home  | Week-to-Date Stats             |
| - Play* | Hitters: .265 AVG, .750 OPS    |
| - Draft | Pitchers: 4.20 ERA, 1.35 WHIP  |
| - Set*  |                                |
|         | My Team Heatmap                |
|         | [Player] W1 W2 W3 ... W10      |
|         | Bobby    🔥 🔥 🟡 ... 🔵       |
|         |                                |
|         | Watchlist Heatmap              |
|         | [Player] W1 W2 W3 ... W10      |
+------------------------------------------+
```

### Players Page
```
+------------------------------------------+
| Filters: [SS, 2B ▾] [Available ▾]       |
| Search: [_______]  [Stats ⟷ Heat]      |
+------------------------------------------+
| Name       Pos  Team   PA  AVG  OPS  ⭐  |
|------------------------------------------|
| Witt Jr    SS   KC    450 .300 .850  ⭐ |
| Judge      OF   NYY   420 .311 .915  ☆ |
| Soto       OF   NYY   445 .325 .925  ⭐ |
+------------------------------------------+
```

**The goal: Fast, scannable, action-oriented pages for quick decision-making.**
