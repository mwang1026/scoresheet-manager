# Design Guidelines

## Philosophy
Bloomberg Terminal, not ESPN. Functional over decorative.
Dark-only theme — "The Analyst's Desk" warm dark terminal aesthetic with amber/gold accents.

## Core Principles

### 1. Information Density
- Compact tables, minimal scrolling
- Every pixel serves a purpose
- Dense but not cluttered

### 2. Tables Are Primary UI
- Sortable columns
- Sticky headers
- Alternating row backgrounds (subtle)
- Tight padding: `py-1.5 px-2` universal standard
- **Tabular numerals** for all numbers
- Left-align text, right-align numbers

### 3. Color

**Dark-only theme** — no light mode, no toggle. The dark terminal IS the identity.

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--background` | `30 8% 9%` | `#1a1816` | Page background |
| `--foreground` | `35 20% 88%` | `#e8e4df` | Primary text |
| `--card` | `30 6% 16%` | `#2a2826` | Card/panel surface |
| `--card-elevated` | `20 6% 19%` | `#322f2d` | Panel headers, elevated surfaces |
| `--muted` | `30 6% 16%` | `#2a2826` | Alt rows, table header bg |
| `--muted-foreground` | `20 5% 46%` | `#7a7470` | Secondary text, labels |
| `--border` | `20 7% 22%` | `#3a3632` | All borders |
| `--brand` | `38 59% 56%` | `#d4a54a` | Amber accent — links, active states, stars |
| `--destructive` | `350 46% 60%` | `#cf6679` | Red/cold/IL indicators |
| `--total-row` | `30 6% 20%` | | Totals row bg |
| `--row-hover` | `30 6% 22%` | | Row hover bg |
| `--ring` | `38 59% 56%` | | Focus rings (amber) |

**Brand Amber:** `hsl(38 59% 56%)` / `#d4a54a`
- Team name accent, active states, inline highlights, watchlist stars, nav accents
- CSS variable: `--brand`
- Tailwind: `text-brand`, `bg-brand`, `bg-brand/10` etc.

**Hot/Cold (unchanged):**
- Red (#DC2626) - Hot
- Orange (#F59E0B) - Warm
- Gray (#9CA3AF) - Neutral
- Blue (#3B82F6) - Cold

### 4. Typography
- Sans-serif (Inter) for body text
- Monospace (JetBrains Mono) for stats, sidebar branding
- Tabular numerals for stats
- Clear hierarchy

## Components

### `<SectionPanel>`
Shared component for all card/panel sections. Replaces inline panel patterns.

```tsx
<SectionPanel title="My Hitters" badge="14" action={<Link>Manage</Link>}>
  {children}
</SectionPanel>
```

Design:
- Outer: `border border-border rounded-md overflow-hidden border-t-2 border-t-brand bg-card`
- Header: `px-4 py-2.5 border-b border-border bg-card-elevated`
- Title: `text-sm font-semibold text-foreground`
- Badge: `font-mono text-xs text-muted-foreground`

### Toggle Buttons
Active: `bg-brand/15 text-brand border border-brand/30`
Inactive: `bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent`

Used in: stats source toggle, hitter/pitcher tabs, status filters, pagination, draft pick filters.

### Action Slot Links (in panel headers)
`text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5`

## Patterns

### Cards
Use `<SectionPanel>` for all card-like containers. NOT cards for player lists — use tables.

### Filters
- Checkboxes with "Clear All"
- Show applied filters as chips
- Filter count badge
- Dropdown shadow: `shadow-lg shadow-black/40` (visible on dark bg)

### Heatmaps
- 10-week grid, color-coded
- Hover shows stats
- Click opens filtered detail

## Sidebar
- Brand text: `font-mono font-semibold text-sm` ("Scoresheet Manager")
- Collapsed "SM": `font-mono font-semibold text-brand`
- Active nav: `border-l-2 border-l-brand` (amber left accent)
- Inactive nav: `border-l-2 border-l-transparent` (reserve space)

## Responsive

- **Desktop (>1024px):** Full sidebar, multi-column
- **Tablet (768-1024px):** Collapsed sidebar, horizontal scroll
- **Mobile (<768px):** Bottom nav, card fallback for complex tables

## States

- **Loading:** Skeleton screens
- **Errors:** Toast notifications
- **Empty:** Helpful messages
- **Freshness:** "Last updated: X min ago"

## Animation
Minimal. Smooth transitions (150-250ms) for hovers, modals, toasts. No page transitions.

## Accessibility
- Semantic HTML
- Keyboard navigation
- WCAG AA contrast (4.5:1)
- ARIA labels for icons

## Anti-Patterns (DON'T)
- Cards for table rows
- Excessive padding/whitespace
- Modal-heavy workflows
- Decorative animations
- Unstructured stat walls
- Light mode or light-mode artifacts
- Hardcoded hex colors (use CSS variables)

## Example Table
```jsx
<table className="w-full text-xs">
  <thead className="sticky top-0 bg-muted border-b-2 border-border">
    <tr>
      <th className="py-1.5 px-2 text-left font-semibold text-foreground">Name</th>
      <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">AVG</th>
    </tr>
  </thead>
  <tbody>
    <tr className="even:bg-muted hover:bg-row-hover transition-colors duration-100">
      <td className="py-1.5 px-2 font-medium">Bobby Witt Jr</td>
      <td className="py-1.5 px-2 text-right font-mono tabular-nums">.300</td>
    </tr>
  </tbody>
</table>
```

**Form follows function.**
