# Database Schema - Scoresheet Manager

## Critical Principles

### 1. Store Raw Stats Only - NEVER Calculate
**The most important rule:** NEVER store AVG, OPS, ERA, WHIP, etc. in the database.

**Store only raw inputs:**
- Hitters: PA, AB, H, 2B, 3B, HR, BB, HBP, SF, SO, SB, CS, R, RBI
- Pitchers: G, GS, IP (as outs), ER, H, BB, K, HR, SV, W, L

**Calculate on query:**
- AVG = H / AB
- OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
- SLG = (1B + 2×2B + 3×3B + 4×HR) / AB
- OPS = OBP + SLG
- ERA = (ER / IP) × 9
- WHIP = (H + BB) / IP

**Why:**
- Prevents inconsistencies
- Allows formula changes without backfill
- Date range aggregations need raw inputs
- Storage is cheap, migration is expensive

### 2. Store ALL Available Stats (Future-Proof)
Store comprehensive stats from MLB API, not just MVP display columns.

**Why:** No schema changes or backfills when adding new features.

### 3. Dense Tables, Separate by Role
**Hitters and pitchers in separate tables:**
- `hitter_daily_stats` - only hitter columns (no null pitching fields)
- `pitcher_daily_stats` - only pitcher columns (no null hitting fields)
- Two-way players get rows in both tables (rare, acceptable)

**Why:** Avoids sparse tables with 50% null columns.

### 4. Daily Granularity Only
- One row per player per day
- No intra-day updates
- Aggregate on query for custom date ranges

### 5. Innings Pitched as Outs (Avoid Decimals)
**Store IP as total outs (INT), not decimal:**
- 5.1 IP = 16 outs
- 6.2 IP = 20 outs
- Calculate display: IP = outs / 3

**Why:** Avoids floating-point precision issues.

---

## Core Entities

### Users
- Email (unique) - OAuth identifier
- Team ID - Their Scoresheet team
- Role - Admin/user (future)

**Note:** This table IS the allowlist.

### Teams
- Name ("Team Mike")
- Scoresheet team ID
- Is my team flag

**10 teams total, relatively static.**

### Players
- Name
- MLB ID, Scoresheet ID
- Primary position
- Current team ("NYY", "BOS")
- Trade bait status (boolean)

**~1,500-2,000 players.**

### Player Positions
- Player ID
- Position ("SS", "2B")
- Defensive value (Scoresheet rating, decimal)

**Multi-position players (e.g., Witt Jr: SS 3.5, 2B 2.8).**

### Player Roster (Ownership)
- Player ID
- Team ID
- Status (rostered, available, keeper, dropped)
- Added/dropped dates

**Tracks ownership history.**

### Hitter Daily Stats
**Comprehensive raw stats:**
- Player ID, Date
- **Appearances:** PA, AB
- **Hits:** H, 1B, 2B, 3B, HR
- **Outs:** SO, GO, FO, GDP
- **Walks:** BB, IBB, HBP
- **Bases:** SB, CS
- **Scoring:** R, RBI
- **Sacrifice:** SF, SH

**Primary key:** (player_id, date)  
**Indexes:** (player_id, date), (date)

### Pitcher Daily Stats
**Comprehensive raw stats:**
- Player ID, Date
- **Games:** G, GS, GF, CG, SHO, SV, HLD
- **Innings:** IP_outs (stored as INT - total outs)
- **Results:** W, L, ER, R
- **Batters:** BF
- **Outcomes:** H, BB, IBB, HBP, K, HR
- **Control:** WP, BK

**Primary key:** (player_id, date)  
**Indexes:** (player_id, date), (date)

### Player Weekly Heat (Materialized View)
**Pre-computed hot/cold status by week:**
- Player ID
- Week start date (Monday)
- Player type (hitter, SP, RP)
- Heat level (cold, neutral, warm, hot)
- Raw aggregates for thresholds (PA, AB, H, OPS components for hitters; IP_outs, ER for pitchers)

**Refreshed daily or weekly.**  
**Used for fast heatmap rendering.**

**Calculation:**
```sql
-- Hitters (min 20 PA/week)
CASE 
  WHEN pa < 20 THEN NULL
  WHEN ops < 0.500 THEN 'cold'
  WHEN ops < 0.700 THEN 'neutral'
  WHEN ops < 0.900 THEN 'warm'
  ELSE 'hot'
END
```

### Watchlist
- User ID
- Player ID
- Added timestamp
- Notes

**Simple many-to-many.**

### Projections
- Player ID
- Source ("Steamer", "ZiPS")
- Player type (hitter, pitcher)
- Raw projected stats (PA, AB, H, HR, etc. for hitters; G, IP, ER, etc. for pitchers)

**Multiple sources per player.**

### Player News
- Player ID
- Source ("CBS Sports")
- Headline, URL
- Published timestamp
- Summary (LLM-generated, nullable)

**Scraped articles linked to players.**

### Draft Queue
- User ID
- Player ID
- Rank (preference order)
- Notes

**Drag-drop reordering updates rank.**

### Draft Picks
- Pick number
- Team ID
- Player ID
- Pick timestamp

**Historical draft record.**

### Draft Schedule
- Pick number
- Team ID
- Scheduled time
- Actual player ID (null until picked)

**Pre-populated from Scoresheet scrape.**

---

## Performance Requirements

### Fast (<100ms)
- Single player, date range
- Dashboard aggregates (my team stats)
- Heatmap data (from materialized view)

### Acceptable (<500ms)
- All players stats for one day
- Complex multi-week aggregations

### Batch (<5 seconds)
- Daily stats import (~1,500 players)
- Weekly heatmap refresh
- Projection CSV upload

---

## Query Examples

**Get hitter OPS for date range:**
```sql
SELECT 
  player_id,
  SUM(h) as h,
  SUM(ab) as ab,
  ROUND(CAST(SUM(h) AS DECIMAL) / NULLIF(SUM(ab), 0), 3) as avg,
  -- Calculate OBP, SLG, OPS...
FROM hitter_daily_stats
WHERE player_id = ?
  AND date BETWEEN ? AND ?
GROUP BY player_id;
```

**Get pitcher ERA for date range:**
```sql
SELECT
  player_id,
  SUM(ip_outs) as outs,
  SUM(er) as er,
  ROUND(CAST(SUM(ip_outs) AS DECIMAL) / 3, 1) as ip,
  ROUND((CAST(SUM(er) AS DECIMAL) / NULLIF(SUM(ip_outs), 0)) * 27, 2) as era
FROM pitcher_daily_stats
WHERE player_id = ?
  AND date BETWEEN ? AND ?
GROUP BY player_id;
```

---

## Data Volume (Year 1)

| Table | Rows | Notes |
|-------|------|-------|
| Players | 2,000 | Slow growth |
| Hitter Daily Stats | 300K | 1,500 players × 200 days |
| Pitcher Daily Stats | 200K | 1,000 pitchers × 200 days |
| Weekly Heat | 30K | 2,000 players × 15 weeks |
| News | 50K | ~250 articles/day × 200 days |

**Total: ~500MB-1GB/season**

---

## Foreign Keys & Constraints

**Cascade deletes:**
- User deleted → cascade Watchlist, Draft Queue

**Prevent deletes:**
- Player → never delete (has stats history)
- Team → never delete (protect historical data)

**Unique constraints:**
- Users: email
- Players: mlb_id, scoresheet_id
- Daily Stats: (player_id, date)
- Watchlist: (user_id, player_id)

---

## Migration Strategy

1. Create tables in dependency order (Players first)
2. Add indexes AFTER initial data load (faster bulk insert)
3. Create materialized views last
4. Use Alembic for all changes
5. Never drop columns (add new, deprecate old)

---

## Common Pitfalls

- ❌ Storing AVG, OPS, ERA in database
- ❌ Combining hitters/pitchers in one table
- ❌ Using DECIMAL for IP (use outs as INT)
- ❌ Missing indexes on (player_id, date)
- ❌ Storing calculated stats in materialized view without raw inputs
