# Design Guidelines

## Philosophy
Bloomberg Terminal, not ESPN. Functional over decorative.

## Core Principles

### 1. Information Density
- Compact tables, minimal scrolling
- Every pixel serves a purpose
- Dense but not cluttered

### 2. Tables Are Primary UI
- Sortable columns
- Sticky headers
- Alternating row backgrounds (subtle)
- Tight padding (6-8px vertical, 12px horizontal)
- **Tabular numerals** for all numbers
- Left-align text, right-align numbers

### 3. Color
- Neutral base (white/light gray)
- One brand color (blue)
- One accent (orange for urgency)
- Red/green only for performance indicators

**Hot/Cold:**
- Red (#DC2626) - Hot
- Orange (#F59E0B) - Warm
- Gray (#9CA3AF) - Neutral
- Blue (#3B82F6) - Cold

### 4. Typography
- Sans-serif (Inter)
- Tabular numerals for stats
- Clear hierarchy

## Patterns

### Cards
Use sparingly: team grid, dashboard sections. NOT for player lists.

### Filters
- Checkboxes with "Clear All"
- Show applied filters as chips
- Filter count badge

### Heatmaps
- 10-week grid, color-coded
- Hover shows stats
- Click opens filtered detail

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

## Tailwind Setup
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFeatureSettings: {
        'tnum': '"tnum"', // tabular numerals
      }
    }
  }
}
```

## Example Table
```jsx
<table className="w-full">
  <thead className="sticky top-0 bg-white border-b">
    <tr className="text-sm text-gray-600">
      <th className="text-left p-3">Name</th>
      <th className="text-right p-3 tabular-nums">AVG</th>
    </tr>
  </thead>
  <tbody>
    <tr className="hover:bg-gray-50 even:bg-gray-25">
      <td className="p-3 font-medium">Bobby Witt Jr</td>
      <td className="p-3 text-right tabular-nums">.300</td>
    </tr>
  </tbody>
</table>
```

**Form follows function.**