# Scout Platform Redesign Spec

## Overview

GitScout is being rebranded to **Scout** and restructured from a single-purpose GitHub sourcing tool into a full recruiting intelligence platform. This spec covers the rebrand, navigation redesign, and dashboard implementation.

## Scope of Work

### 1. Rebrand: GitScout → Scout

**Search and replace across entire codebase:**
- All user-facing text: "GitScout" → "Scout"
- Page titles, meta tags, Open Graph tags
- Logo components and SVGs
- README, package.json name/description
- Any hardcoded brand references in components
- Favicon (generate a simple gold square with "S" if a proper icon isn't available)

**Do NOT rename:**
- The git repository itself
- Internal variable names that reference "gitscout" in non-user-facing code (rename these only if trivial)
- Database table names or Supabase project names

### 2. Design System Updates

**Font:**
Replace the current font with Instrument Sans. Add the Google Fonts import to the root layout:
```
https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap
```
Update the Tailwind config or global CSS to set Instrument Sans as the primary sans font.

**Color palette — add to CSS variables or Tailwind config:**
```css
--scout-gold: #C8A55A;
--scout-gold-muted: #8B6914;
--scout-gold-bg: rgba(200, 165, 90, 0.08);
--scout-gold-bg-hover: rgba(200, 165, 90, 0.12);
--scout-sidebar-bg: #19191A;
--scout-sidebar-text: #E8E6DF;
--scout-sidebar-muted: rgba(232, 230, 223, 0.35);
--scout-sidebar-section: rgba(232, 230, 223, 0.2);
--scout-sidebar-active-bg: rgba(232, 230, 223, 0.06);
--scout-urgent: #C2413C;
--scout-success: #2D6A4F;
--scout-warning: #8B6914;
```

**Replace the old brand green** (#0F6E56 or similar) with gold (#C8A55A) for primary CTAs, active nav indicators, badge accents, and logo. Keep green (#2D6A4F) only for positive/success indicators.

### 3. Sidebar Navigation

Replace existing navigation with the new grouped sidebar.

**Create:** `src/components/layout/Sidebar.tsx`

**Structure:**
```
<aside> (224px fixed, #19191A bg, flex column, full height)
  Logo: Gold square (30x30, r7, #C8A55A) + icon + "Scout" (17px 700) + "RECRUITING INTELLIGENCE" (9px uppercase)
  Dashboard nav item (standalone)
  12px spacer
  
  SOURCE section label
    Developer search (magnifying glass icon)
    Market map (map icon) [NEW]
  
  CONNECT section label
    Connection mapper (chain links icon) [NEW]
    Outreach (paper plane icon)
  
  MANAGE section label
    Pipeline (funnel icon)
    Saved lists (bullet list icon)
    Templates (copy icon)
  
  INTELLIGENCE section label
    Alerts (bell icon) [SOON]
    Analytics (bar chart icon) [SOON]
  
  auto spacer
  Settings (gear icon)
  User card (avatar, name, plan, notification bell)
</aside>
```

Active state: 2px left border #C8A55A, bg rgba(232,230,223,0.06), text #E8E6DF.
Use `usePathname()` to detect active route.

Icons: 15x15 SVGs, stroke-based, 1.1-1.2px. See scout-platform-redesign.jsx for exact paths.

### 4. Layout Wrapper

**Create:** `src/components/layout/AppShell.tsx`

```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <main className="flex-1 min-w-0 overflow-auto bg-[var(--color-background-tertiary)]">
    <div className="max-w-[1020px] px-9 py-7">
      {children}
    </div>
  </main>
</div>
```

Apply to all authenticated pages.

### 5. Dashboard Page

**Route:** `/` or `/dashboard`

**A. Greeting:** "Good [morning/afternoon/evening], [name]" + activity summary subtitle
**B. Quick actions:** 3 cards — New market map, Search developers, Map connections
**C. Stats:** 4 cards — Active maps, Candidates tracked, Warm connections (gold), Response rate (green)
**D. Two columns:**
  - Left: Recent searches (from market_maps, ordered by updated_at)
  - Right: Alerts feed + Connection mapper setup CTA

### 6. Routes

Create these (placeholder pages for unbuilt features):
```
/              → Dashboard
/search        → Developer search (existing)
/market-map    → Market map (existing)
/connections   → Connection mapper
/outreach      → Outreach (placeholder)
/pipeline      → Pipeline (placeholder)
/lists         → Saved lists (existing)
/templates     → Templates
/alerts        → Alerts (placeholder)
/analytics     → Analytics (placeholder)
/settings      → Settings (existing)
```

Placeholders should be polished: page title, brief description, "COMING SOON" gold badge.

### 7. Migration Checklist

- [ ] Install Instrument Sans font
- [ ] Add Scout color variables
- [ ] Replace "GitScout" → "Scout" in all user-facing text
- [ ] Update page titles and meta to "Scout — Recruiting intelligence"
- [ ] Build Sidebar component
- [ ] Build AppShell layout wrapper
- [ ] Apply AppShell to all authenticated routes
- [ ] Remove old nav component
- [ ] Build Dashboard page
- [ ] Create placeholder pages
- [ ] Update existing pages to new layout
- [ ] Verify nav links and active states
- [ ] Test responsive behavior

### 8. Notes

- Don't break existing functionality. Search, market map, and lists keep working.
- Sidebar is always visible on desktop (224px). Hide behind hamburger on mobile (<768px).
- The prototype JSX (scout-platform-redesign.jsx) is the visual reference — match it exactly.
- Placeholder pages should look polished and on-brand.
