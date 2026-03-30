# Agent Task: Frontend Polish, Responsive Design, SEO & Error States

## Your Job

Take the existing functional UI and make it production-quality. Add loading skeletons and error boundaries everywhere, make the responsive design tight on mobile, add dynamic SEO metadata to profile pages, polish the visual design, and add a few missing UX features (keyboard shortcuts, URL-synced filter state, and a proper 404 page).

---

## Context

- **Stack:** Next.js 16.2.1, React 19, Tailwind CSS 4, TypeScript
- **Icon library:** `lucide-react` — but `Github` and `Twitter` icons don't exist in this version. Use `GitBranch` and `AtSign` instead.
- **Utility classes:** Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Path alias:** `@/*` maps to `./src/*`
- **Dark mode:** Handled via `prefers-color-scheme` media query in CSS. All components already use `dark:` Tailwind variants. Keep this approach (no theme toggle needed).
- **Fonts:** Geist Sans + Geist Mono via `next/font/google`.
- **Current state:** UI works but profile page has no loading state, no error boundaries, filter state resets on navigation, and mobile layout needs tightening.

---

## Files to Modify

### Must change:
- **`src/app/page.tsx`** — Polish landing page. Add subtle animation/transitions. Improve stat cards layout on mobile (2-col grid can be tight on 320px screens).
- **`src/app/search/page.tsx`** — Sync filter state with URL params so filters survive refresh/back navigation. Add keyboard shortcut (Cmd/Ctrl+K) to focus search.
- **`src/app/profile/[username]/page.tsx`** — Add dynamic `generateMetadata()` for SEO (title, description, og:image). Add `loading.tsx` sibling for streaming skeleton. Add `not-found.tsx` sibling.
- **`src/app/layout.tsx`** — Minor: add default `og:image` and site-wide meta.
- **`src/components/search/SearchFilters.tsx`** — Accept `defaultValues` prop so filters can be initialized from URL params.
- **`src/components/search/SearchResults.tsx`** — Improve empty state with illustration or suggestion. Polish skeleton pulse animation.
- **`src/components/profile/DeveloperCard.tsx`** — Add hover animation. Ensure text truncation works on long bios.
- **`src/components/layout/Header.tsx`** — Make nav responsive (hamburger on mobile or simplified nav).

### Must create:
- **`src/app/profile/[username]/loading.tsx`** — Skeleton screen for profile page (Next.js streaming).
- **`src/app/profile/[username]/not-found.tsx`** — Custom 404 for unknown developers.
- **`src/app/not-found.tsx`** — Global 404 page.
- **`src/app/error.tsx`** — Global error boundary (must be a Client Component with `"use client"`).

### May create:
- **`src/components/ui/Skeleton.tsx`** — Reusable skeleton component if the pattern repeats enough.
- **`src/components/ui/EmptyState.tsx`** — Reusable empty state with icon + message + action.

---

## Do NOT Touch

- **`src/app/api/`** — No API route changes (AGENT_PIPELINE owns search, AGENT_AUTH owns auth)
- **`src/pipeline/`** — Data pipeline (AGENT_PIPELINE + AGENT_SCORING)
- **`src/lib/prisma.ts`** — Shared Prisma client
- **`src/lib/utils.ts`** — You may read it and use its functions, but don't modify it (other agents depend on it). If you need a new utility, add it to a new file or inline it.
- **`prisma/schema.prisma`** — No schema changes (AGENT_PIPELINE + AGENT_SCORING)
- **Auth UI** — AGENT_AUTH will handle login buttons, session display, etc.

---

## Acceptance Criteria

### 1. Profile Page SEO
- Add `generateMetadata()` async function to `src/app/profile/[username]/page.tsx`:
  ```typescript
  export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
    const { username } = await params;
    // Fetch developer, return title + description + og:image
  }
  ```
- Title format: `"{name} (@{username}) — Scout"`
- Description: `"{bio}"` or `"Developer profile for {username} on Scout"`
- `og:image`: Use the developer's `avatarUrl`
- If developer not found, return generic metadata (don't error)

### 2. Loading & Error States
- **Profile loading:** Create `src/app/profile/[username]/loading.tsx` with a skeleton that matches the profile layout (avatar circle, text bars, language bar placeholder, repo card placeholders).
- **Profile not found:** Create `src/app/profile/[username]/not-found.tsx` — friendly message with link back to search.
- **Global error boundary:** Create `src/app/error.tsx` as a Client Component with a "Something went wrong" message and a "Try again" button that calls `reset()`.
- **Global 404:** Create `src/app/not-found.tsx` — branded 404 with search bar.

### 3. URL-Synced Filters
- When filters are applied on `/search`, encode them into URL search params:
  `/search?q=rust&languages=TypeScript,Python&location=SF&minStars=100&sort=stars`
- When the search page loads, read URL params and initialize filter state from them.
- `SearchFilters` component must accept a `defaultValues` prop.
- Back/forward browser navigation should restore the correct filter state.

### 4. Responsive Design
- Test at 375px width (mobile), 768px (tablet), 1280px (desktop).
- **Landing page:** Search bar should be full width on mobile. Stat cards: single column on <400px.
- **Search page:** Filter panel should stack vertically. Language pills should wrap. Results cards should be single-column.
- **Profile page:** Avatar + info should stack on mobile (currently `sm:flex-row`). Repo grid should be single-column on mobile.
- **Header:** On mobile, consider hiding nav text or using a compact layout. The current `gap-6` might be tight on 320px.

### 5. Polish
- Add `transition-all` or subtle hover effects on interactive elements.
- DeveloperCard should have a slight scale or shadow change on hover.
- Focus states on all inputs and buttons (for keyboard navigation).
- The search input's clear button (X) should be keyboard-accessible.

### 6. Build Must Pass
- Run `npm run build` and ensure zero errors.
- No TypeScript errors, no missing imports.

---

## Technical Notes & Gotchas

- **Next.js 16 async APIs:**
  - `params` is a `Promise` — must `await params` in server components and `generateMetadata`.
  - `searchParams` in page components is also a `Promise` in Next.js 16.
  - In client components, use `useSearchParams()` from `next/navigation` (returns synchronous values, but must be wrapped in `<Suspense>`).

- **`loading.tsx` convention:** This file is auto-used by Next.js for streaming. It should be a Server Component (no `"use client"`). It renders while the page's async data is loading.

- **`error.tsx` convention:** Must have `"use client"` directive. Receives `{ error, reset }` props.

- **`not-found.tsx` convention:** Triggered by calling `notFound()` from `next/navigation`. The current profile page already calls `notFound()` when the developer doesn't exist.

- **Tailwind CSS 4:** Uses `@import "tailwindcss"` instead of `@tailwind` directives. The `@theme inline` block in `globals.css` defines CSS variables. Tailwind 4 auto-detects classes from source files — no `content` config needed.

- **`lucide-react` icon names:** These icons DON'T exist: `Github`, `Twitter`. Use `GitBranch`, `AtSign` instead. Check imports if you add new icons — the installed version may not have the latest icons. Verify by checking `node_modules/lucide-react/dist/esm/lucide-react.js`.

- **Image optimization:** The profile page uses `<img>` tags (with eslint-disable for `@next/next/no-img-element`) because GitHub avatar URLs are external. If you want to switch to `next/image`, you'll need to add `images.remotePatterns` for `avatars.githubusercontent.com` in `next.config.ts`. Either approach is fine.

- **The `cn()` utility** combines `clsx` + `tailwind-merge`. Use it for conditional classes:
  ```typescript
  className={cn("base-classes", condition && "conditional-classes")}
  ```

- **`formatNumber()`, `timeAgo()`, `getLanguageColor()`** are all in `src/lib/utils.ts` and already used by components. Reuse them.
