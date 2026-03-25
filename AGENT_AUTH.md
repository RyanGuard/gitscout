# Agent Task: Authentication, User Accounts & Favorites

## Your Job

Implement GitHub OAuth authentication using NextAuth.js v4, add a User model to the database, build a favorites/bookmarking system so logged-in users can save developers, and add the auth UI (sign in button, user avatar, sign out). The packages `next-auth` and `@auth/prisma-adapter` are already installed.

---

## Context

- **Stack:** Next.js 16.2.1, React 19, Tailwind CSS 4, Prisma 7, TypeScript
- **Prisma client import:** `import { PrismaClient } from "@/generated/prisma/client"` (NOT `@prisma/client`)
- **Prisma types import:** `import type { Prisma } from "@/generated/prisma/client"`
- **Path alias:** `@/*` maps to `./src/*`
- **Live at:** https://gitscout-beta.vercel.app
- **DB:** Supabase PostgreSQL via session pooler. Connection in `DIRECT_DATABASE_URL`.
- **Installed packages:** `next-auth@^4.24.13`, `@auth/prisma-adapter@^2.11.1`
- **Current state:** No auth. Empty `src/app/api/auth/` directory. No User/Account/Session models in schema. Header has no sign-in button.

---

## Files to Create

### Must create:
- **`src/app/api/auth/[...nextauth]/route.ts`** — NextAuth catch-all route handler. Configure GitHub provider, Prisma adapter, callbacks.
- **`src/lib/auth.ts`** — Centralized NextAuth config export (so it can be imported by both the route and `getServerSession` calls).
- **`src/components/auth/AuthButton.tsx`** — Client component. Shows "Sign in with GitHub" when logged out, shows user avatar + name + sign out when logged in.
- **`src/app/api/favorites/route.ts`** — GET (list user's favorites) and POST (add favorite) endpoints.
- **`src/app/api/favorites/[developerId]/route.ts`** — DELETE (remove favorite) endpoint.
- **`src/app/favorites/page.tsx`** — Page showing the user's saved/bookmarked developers.

### Must modify:
- **`prisma/schema.prisma`** — Add `User`, `Account`, `Session`, `VerificationToken` models (required by `@auth/prisma-adapter`), plus a `Favorite` model linking User to Developer.
- **`src/components/layout/Header.tsx`** — Add `AuthButton` to the nav. Keep existing nav links.
- **`src/app/profile/[username]/page.tsx`** — Add a "Save" / "Unsave" button on the profile page for logged-in users.

### Must read (but be careful modifying):
- **`src/lib/prisma.ts`** — Use this Prisma instance in your auth config. Do NOT modify this file.
- **`.env`** — You'll need `GITHUB_ID`, `GITHUB_SECRET`, and `NEXTAUTH_SECRET` env vars. Document these but obviously don't commit real values.

---

## Do NOT Touch

- **`src/pipeline/`** — Data pipeline (AGENT_PIPELINE + AGENT_SCORING)
- **`src/app/api/search/`** — Search endpoint (AGENT_PIPELINE)
- **`src/app/api/pipeline/`** — Sync endpoint (AGENT_PIPELINE)
- **`src/app/api/stats/`** — Stats endpoint
- **`src/app/page.tsx`** — Landing page (AGENT_UI)
- **`src/app/search/page.tsx`** — Search page (AGENT_UI)
- **`src/lib/utils.ts`** — Shared utilities
- **`src/components/search/`** — Search components (AGENT_UI)
- **`src/components/profile/DeveloperCard.tsx`** — Search result cards (AGENT_UI)
- Scoring logic — AGENT_SCORING

---

## Acceptance Criteria

### 1. GitHub OAuth Login Works
- Users can click "Sign in with GitHub" and complete the OAuth flow.
- After login, the session contains `user.id`, `user.name`, `user.email`, `user.image`.
- Session persists across page reloads.
- Sign out clears the session.
- Works on both localhost and the Vercel deployment.

### 2. Prisma Schema Has Auth Models
The following models must be added (per `@auth/prisma-adapter` requirements):

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  favorites     Favorite[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Favorite {
  id          String   @id @default(cuid())
  userId      String
  developerId String
  createdAt   DateTime @default(now())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  developer   Developer @relation(fields: [developerId], references: [id], onDelete: Cascade)

  @@unique([userId, developerId])
}
```

**Important:** You must also add `favorites Favorite[]` to the existing `Developer` model.

### 3. NextAuth Configuration
- **Provider:** GitHub OAuth (`next-auth/providers/github`)
- **Adapter:** `@auth/prisma-adapter` with the Prisma client from `src/lib/prisma.ts`
- **Callbacks:**
  - `session` callback: Include `user.id` in the session object
  - `signIn` callback: Allow all GitHub users
- **Secret:** Read from `NEXTAUTH_SECRET` env var
- **Auth route:** `src/app/api/auth/[...nextauth]/route.ts` — export GET and POST handlers

### 4. Auth UI
- **`AuthButton` component:**
  - Logged out: "Sign in" button (subtle, matches header style)
  - Logged in: User's GitHub avatar (small, 32px rounded), click shows dropdown with name + "Sign out" + "My Favorites"
  - Use `useSession()` from `next-auth/react`
- **Session provider:** Wrap the app in `<SessionProvider>` in `layout.tsx` (or create a `Providers` client component wrapper since layout is a server component).

### 5. Favorites System
- **`POST /api/favorites`** — Body: `{ developerId: string }`. Requires auth. Creates a Favorite. Returns 201.
- **`DELETE /api/favorites/[developerId]`** — Requires auth. Removes the favorite. Returns 200.
- **`GET /api/favorites`** — Requires auth. Returns the user's favorite developers with full profile data.
- **Profile page:** Show a heart/bookmark icon on the developer profile. Filled if favorited, outline if not. Clicking toggles. Only visible when logged in.
- **Favorites page** (`/favorites`): Grid of DeveloperCards for saved developers. Show empty state if none.

### 6. Protected Routes
- Use `getServerSession()` in server components and API routes to check auth.
- API routes (`/api/favorites/*`) return 401 if not authenticated.
- The `/favorites` page redirects to `/` (or shows a "Sign in to see favorites" message) if not logged in.

### 7. Build Must Pass
- Run `npm run build` and ensure zero errors.
- No TypeScript errors. NextAuth types should work with the session callback.

---

## Technical Notes & Gotchas

- **NextAuth v4 with App Router:** The route handler file must be at `src/app/api/auth/[...nextauth]/route.ts` and export:
  ```typescript
  import NextAuth from "next-auth";
  import { authOptions } from "@/lib/auth";

  const handler = NextAuth(authOptions);
  export { handler as GET, handler as POST };
  ```

- **`@auth/prisma-adapter` with Prisma 7:** The adapter expects a `PrismaClient` instance. Import from `src/lib/prisma.ts`:
  ```typescript
  import { PrismaAdapter } from "@auth/prisma-adapter";
  import { prisma } from "@/lib/prisma";

  adapter: PrismaAdapter(prisma),
  ```
  If there's a type mismatch (Prisma 7 vs adapter expectations), cast with `as any` — this is a known compatibility gap.

- **Session Provider in Server Layout:** `layout.tsx` is a server component. You can't use `<SessionProvider>` directly. Create a client wrapper:
  ```typescript
  // src/components/auth/Providers.tsx
  "use client";
  import { SessionProvider } from "next-auth/react";

  export function Providers({ children }: { children: React.ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
  }
  ```
  Then wrap `{children}` in layout.tsx with `<Providers>`.

- **`getServerSession` in Next.js 16:**
  ```typescript
  import { getServerSession } from "next-auth";
  import { authOptions } from "@/lib/auth";

  const session = await getServerSession(authOptions);
  ```

- **GitHub OAuth App Setup:** The user needs to create a GitHub OAuth App at https://github.com/settings/developers with:
  - Homepage URL: `https://gitscout-beta.vercel.app`
  - Callback URL: `https://gitscout-beta.vercel.app/api/auth/callback/github`
  - For local dev: `http://localhost:3000/api/auth/callback/github`

  Document this in a comment at the top of `src/lib/auth.ts`.

- **Environment variables needed (document in `.env.example`):**
  ```
  GITHUB_ID=your_github_oauth_app_client_id
  GITHUB_SECRET=your_github_oauth_app_client_secret
  NEXTAUTH_SECRET=any_random_32char_string
  NEXTAUTH_URL=https://gitscout-beta.vercel.app
  ```

- **Prisma 7 generated client path:** `@/generated/prisma/client` — not `@prisma/client`. This directory is gitignored and must be generated with `npx prisma generate`.

- **`prisma db push` after schema changes.** Don't create migration files — use `db push` for this project.

- **Next.js 16 `params`:** In `src/app/api/favorites/[developerId]/route.ts`, params is a Promise:
  ```typescript
  export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ developerId: string }> }
  ) {
    const { developerId } = await params;
    // ...
  }
  ```

- **Existing `Developer` model:** You're adding a `favorites Favorite[]` relation to it. Make sure not to remove or rename any existing fields. Just append the relation.

- **The `Header` component** is currently a server component (no `"use client"`). If you add `AuthButton` (which uses `useSession`), you have two options:
  1. Keep Header as server component, import AuthButton as a client component island.
  2. Convert Header to a client component.
  Option 1 is preferred — keep the Header as a server component and just nest the client AuthButton inside it.
