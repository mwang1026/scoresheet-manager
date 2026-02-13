# User Flows - Scoresheet Manager

## Flow 1: Sunday Lineup Check (5 minutes)

**Context:** Sunday afternoon. Review roster before Monday games.

**Goal:** Identify injured/cold players, find replacements.

**Steps:**
1. Open app → Dashboard
2. Check week-to-date team stats (mediocre)
3. Scan My Team heatmap → Notice Bobby Witt Jr has 3 cold weeks (🔵🔵🔵)
4. Click Witt's heatmap square → Player Detail
5. Read news: "Wrist soreness, day-to-day, might rest Monday"
6. Navigate to Players page
7. Filter: Position SS/2B, Status Available
8. Toggle to Hotness View → Sort by W10
9. Find Ezequiel Tovar: 🔥🔥🟡 (hot streak)
10. Click Tovar → Player Detail → Stats look good
11. Add to watchlist (⭐)
12. Return to Dashboard → Watchlist now shows Tovar
13. Decision made: "If Witt sits Monday, grab Tovar"

**Outcome:** Problem identified, solution found, watchlist updated.

---

## Flow 2: Draft Preparation (2 hours)

**Context:** Draft in 2 days. Build draft queue.

**Goal:** Prepare ranked preferences for draft.

**Steps:**
1. Settings → Data Import
2. Upload Steamer projections CSV → Preview → Import
3. Upload ZiPS projections CSV → Import
4. Paste draft order HTML → System parses schedule
5. Navigate to Draft → Projections tab
6. Select "Steamer" as source
7. Sort by projected OPS (hitters)
8. Top players: Bobby Witt Jr, Gunnar Henderson, Corbin Carroll
9. Click "Add to Queue" for each (top 20 hitters)
10. Switch to pitchers → Sort by projected ERA
11. Add top 15 SPs to queue
12. My Queue tab → Drag-drop to reorder:
    - 1. Bobby Witt Jr
    - 2. Gunnar Henderson
    - 3. Corbin Carroll
    - 4. Tarik Skubal
    - 5. Paul Skenes
13. Toggle to ZiPS → Compare projections
14. ZiPS higher on Skenes → Move him up to #3
15. Save (auto-saved)

**Outcome:** Draft queue built from projections, ready for live draft.

---

## Flow 3: Live Draft Day (Pick Monitoring)

**Context:** Draft happening. 90-minute pick windows.

**Goal:** Track picks, adjust queue, make selections.

**Steps:**
1. 9:00 AM - Draft starts
2. Open app → Draft → Draft Board tab
3. System scrapes at 9:01 AM → Pick #1: Team A selects Bobby Witt Jr
4. Draft Board updates, Witt removed from all lists
5. My Queue auto-adjusts → Gunnar Henderson now #1
6. 10:30 AM - Pick #2: Team B selects Henderson
7. Queue updates → Corbin Carroll now #1
8. Monitor picks #3-6 (not in my queue)
9. 6:00 PM - My turn! (Pick #7)
10. Review queue: Carroll still #1 and available
11. Check Players page → Carroll still shows "Available"
12. **Make pick on Scoresheet site** (manually enter)
13. System scrapes at 6:02 PM → Draft Board shows Pick #7: Team Mike - Corbin Carroll
14. Carroll removed from all available lists
15. Carroll now shows "Rostered by Team Mike" everywhere

**Outcome:** Draft tracked in real-time, queue stayed current, pick executed.

---

## Flow 4: Mid-Week Player Discovery (15 minutes)

**Context:** Wednesday morning. Browsing for pickups.

**Goal:** Find undervalued hot players.

**Steps:**
1. Dashboard → Recent News (if implemented)
2. See headline: "Yordan Alvarez expected back Friday"
3. Click → Player Detail
4. Status: Available (dropped during injury)
5. 10-week heatmap: All gray (injured)
6. News: "3-for-4 in AAA rehab game"
7. Pre-injury stats: .310 AVG, .950 OPS
8. Add to watchlist → Check Friday for activation
9. Navigate to Players page
10. Filter: Status Available
11. Toggle to Hotness View
12. Sort by W10 descending
13. See Ezequiel Duran: 🔥🔥🔥🔥 (4 hot weeks)
14. Click → Player Detail
15. Last 14 days: .340 AVG, .980 OPS, 4 HR
16. News: "Moved to leadoff after injury"
17. Projections: .255 AVG (projections low, but hot streak real)
18. Add to watchlist + queue
19. Filter: Trade Bait = Yes
20. Find Josh Naylor (1B): 🔥🔥🟡, rostered by Team Bob
21. Check Opponents page → Bob weak at pitching
22. Add Naylor to watchlist (trade target)

**Outcome:** 3 opportunities found: injury return, hot available player, trade target.

---

## Common Interaction Patterns

### Pattern 1: Filter → Review → Detail
1. Apply filters to narrow players
2. Review results in table/heatmap
3. Click player for deep dive
4. Make decision (watchlist, queue, ignore)

**Used in:** Players page, Draft page, Watchlist

### Pattern 2: Dashboard → Heatmap → Action
1. Daily check-in (dashboard)
2. Notice hot/cold player in heatmap
3. Click square → Player Detail
4. Read news, check stats
5. Take action (find replacement, hold, etc.)

**Used in:** Daily routine, injury monitoring

### Pattern 3: Queue Management Loop
1. Build queue from projections
2. Adjust based on actual stats (hotness)
3. Re-order as draft progresses
4. Remove drafted players (auto)
5. Make pick when turn comes

**Used in:** Draft preparation and execution

### Pattern 4: Mobile Quick Check
1. Open app on phone
2. Go to Player Detail (from watchlist or search)
3. Read news summary
4. Close app (decision made in <1 minute)

**Used in:** On-the-go checks, breaking news

---

## Implementation Priorities

**Critical flows for MVP:**
- Flow 1 (Sunday check) - Core daily use case
- Flow 2 (Draft prep) - High-stakes, time-sensitive
- Flow 4 (Discovery) - Primary browsing pattern

**Can defer:**
- Flow 3 (Live draft) - Requires scraping automation
- Advanced filtering - Can start with basic filters

**Performance targets:**
- Flow 1 should complete in <5 minutes (app load + navigation)
- Flow 4 browsing should feel instant (<100ms interactions)
- Dashboard load <1 second (critical for daily check-in)

**The theme: Fast decision-making with minimal friction.**
