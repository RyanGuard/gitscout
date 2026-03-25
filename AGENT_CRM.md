# Agent Task: Candidate Management — Lists, Notes, Tags & Pipeline Stages

## Your Job

Evolve the basic favorites system into a proper candidate management interface. Build candidate lists (like folders), per-candidate notes, tagging, and pipeline stage tracking. This is the mini-CRM layer between "finding a candidate" and "pushing them to Ashby." Recruiters need to organize, annotate, and track candidates before taking action.

---

## Context

- **Stack:** Next.js 16.2.1, React 19, Prisma 7, PostgreSQL (Supabase), Tailwind CSS 4, TypeScript
- **Prisma client import:** `import { PrismaClient } from "@/generated/prisma/client"`
- **Path alias:** `@/*` maps to `./src/*`
- **Auth:** NextAuth v4. `getServerSession(authOptions)` for server, `useSession()` for client.
- **Existing Favorite model:** Links User to Developer with `@@unique([userId, developerId])`. The favorites page at `/favorites` shows a flat list of favorited developers.
- **Existing components:** `DeveloperCard`, `Badge`, `Header`, `FavoriteButton`

---

## The CRM Data Model

```
User
  └── CandidateList (many)     — "Rust Engineers Q1", "ML Candidates", "Passive - Senior"
        └── CandidateEntry (many) — Links a Developer to a List
              ├── stage           — "identified", "enriched", "contacted", "replied", "interested", "passed"
              ├── notes (many)    — Timestamped notes from the recruiter
              └── tags (many)     — "strong-fit", "visa-required", "open-to-remote"
```

---

## Files to Create

### Schema Changes — add to `prisma/schema.prisma`:

```prisma
model CandidateList {
  id          String           @id @default(cuid())
  userId      String
  name        String
  description String?
  isDefault   Boolean          @default(false)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries     CandidateEntry[]

  @@index([userId])
}

model CandidateEntry {
  id           String         @id @default(cuid())
  listId       String
  developerId  String
  stage        String         @default("identified")
  addedAt      DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  list         CandidateList  @relation(fields: [listId], references: [id], onDelete: Cascade)
  developer    Developer      @relation(fields: [developerId], references: [id], onDelete: Cascade)
  notes        CandidateNote[]
  tags         CandidateTag[]

  @@unique([listId, developerId])
  @@index([listId])
  @@index([developerId])
}

model CandidateNote {
  id        String         @id @default(cuid())
  entryId   String
  content   String
  createdAt DateTime       @default(now())
  entry     CandidateEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([entryId])
}

model CandidateTag {
  id      String         @id @default(cuid())
  entryId String
  tag     String
  entry   CandidateEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([entryId])
  @@index([tag])
}
```

Add to existing models:
- **User:** `candidateLists CandidateList[]`
- **Developer:** `candidateEntries CandidateEntry[]`

### API Routes:

**Lists:**
- **`src/app/api/lists/route.ts`**
  - GET: List all of the user's candidate lists with entry counts.
  - POST: Create a new list. Body: `{ name, description? }`

- **`src/app/api/lists/[listId]/route.ts`**
  - GET: Get list details with all entries (developers with their stage, tags, notes).
  - PATCH: Update list name/description.
  - DELETE: Delete list and all entries.

**Entries:**
- **`src/app/api/lists/[listId]/entries/route.ts`**
  - POST: Add a developer to a list. Body: `{ developerId, stage?, tags? }`.

- **`src/app/api/lists/[listId]/entries/[entryId]/route.ts`**
  - PATCH: Update stage, add/remove tags. Body: `{ stage?, addTags?, removeTags? }`
  - DELETE: Remove developer from list.

**Notes:**
- **`src/app/api/lists/[listId]/entries/[entryId]/notes/route.ts`**
  - GET: List notes for an entry.
  - POST: Add a note. Body: `{ content }`.

**Quick-add (from any page):**
- **`src/app/api/candidates/add/route.ts`**
  - POST: Add developer to a list from anywhere (profile page, search results, match results). Body: `{ developerId, listId }`. Creates entry with default "identified" stage.

### Pages:

- **`src/app/lists/page.tsx`** — Lists overview. Shows all user's candidate lists as cards with name, description, candidate count, last updated. "Create New List" button. Requires auth.

- **`src/app/lists/[listId]/page.tsx`** — Single list view. Shows:
  - List name + description (editable inline)
  - Pipeline stage columns OR table view (toggle):
    - **Kanban view:** Columns for each stage, drag to move (stretch goal — table is fine for MVP)
    - **Table view:** Rows with: Developer avatar+name, stage dropdown, tags, last note preview, added date, actions
  - Bulk actions: "Push all to Ashby", "Change stage for selected"
  - Filter by stage, tag

### Components:

- **`src/components/crm/AddToListButton.tsx`** — Client component. Replaces or augments the existing FavoriteButton. Shows a "+" icon. On click, opens a dropdown listing the user's lists. Clicking a list adds the developer to that list. Shows "Create new list" option at the bottom. Used on DeveloperCard, profile page, and match results.

- **`src/components/crm/ListCard.tsx`** — Card showing a list's name, description, candidate count, and stage distribution (e.g., "3 identified, 2 contacted, 1 interested").

- **`src/components/crm/CandidateRow.tsx`** — Table row for a candidate in list view. Shows: avatar, name, username, stage dropdown, tags as badges, last note preview, "Push to Ashby" quick action.

- **`src/components/crm/StageDropdown.tsx`** — Dropdown/select for changing a candidate's pipeline stage. Stages:
  ```
  identified → enriched → contacted → replied → interested → passed
  ```
  Each stage has a color:
  - identified: gray
  - enriched: blue
  - contacted: yellow
  - replied: purple
  - interested: green
  - passed: red

- **`src/components/crm/TagInput.tsx`** — Input for adding tags to a candidate entry. Shows existing tags as removable badges. Text input with Enter to add. Suggest common tags from the user's existing tags.

- **`src/components/crm/NoteInput.tsx`** — Expandable textarea for adding notes to a candidate entry. Shows existing notes in reverse chronological order with timestamps.

---

## Files to Modify

- **`prisma/schema.prisma`** — Add CandidateList, CandidateEntry, CandidateNote, CandidateTag models + relations.
- **`src/components/layout/Header.tsx`** — Add "Lists" link to the nav.
- **`src/app/profile/[username]/page.tsx`** — Add AddToListButton component (alongside existing FavoriteButton and PushToAshbyButton).
- **`src/components/profile/DeveloperCard.tsx`** — Consider adding a small AddToListButton on hover (optional — only if it doesn't clutter the card).
- **`src/types/index.ts`** — Add CandidateList, CandidateEntry, CandidateNote interfaces.

---

## Do NOT Touch

- `src/pipeline/` — Data pipeline
- `src/lib/scoring.ts` — Scoring engine
- `src/lib/ashby.ts` — Ashby client (AGENT_ASHBY)
- `src/app/api/ashby/` — Ashby routes (AGENT_ASHBY)
- `src/app/api/search/` — Search endpoint
- `src/app/api/match/` — Matching (AGENT_JD_MATCH)
- `src/app/api/enrich/` — Enrichment (AGENT_ENRICHMENT)
- `src/app/page.tsx` — Landing page
- `src/app/search/page.tsx` — Search page
- `src/lib/prisma.ts` — Shared client
- `src/lib/auth.ts` — Auth config
- `src/lib/utils.ts` — Shared utilities

---

## Acceptance Criteria

### 1. List CRUD
- User can create a list with a name and optional description.
- User can view all their lists with candidate counts.
- User can rename/edit description of a list.
- User can delete a list (deletes all entries, notes, tags in that list).
- Each user has their own lists — no cross-user visibility (for now).

### 2. Add Candidates to Lists
- From a developer's profile page, user can click "Add to List" and select which list.
- If the developer is already in that list, show "Already added" state.
- Adding creates a CandidateEntry with stage "identified".
- A developer can be in multiple lists simultaneously.

### 3. Pipeline Stages
- Each CandidateEntry has a `stage` field.
- User can change the stage via a dropdown in the list view.
- Stage changes update the `updatedAt` timestamp.
- The list view can be filtered by stage.
- Valid stages: `identified`, `enriched`, `contacted`, `replied`, `interested`, `passed`.

### 4. Notes
- User can add timestamped text notes to any candidate entry.
- Notes are shown in reverse chronological order.
- Notes are markdown-compatible (but plain text rendering is fine for MVP).
- Notes belong to the entry, not the developer — different notes per list.

### 5. Tags
- User can add string tags to candidate entries (e.g., "strong-fit", "visa-required", "open-to-remote", "senior").
- Tags shown as colored badges.
- Tags can be removed with an X button.
- The list view can be filtered by tag.
- Suggest previously-used tags when typing (query user's existing tags).

### 6. List View is Functional
- Table view showing all candidates in a list.
- Columns: Avatar+Name, Stage (dropdown), Tags, Last Note (preview), Added Date, Actions.
- Actions: Remove from list, Push to Ashby (if AGENT_ASHBY is built), View Profile.
- Sort by: stage, added date, developer score, name.
- Filter by: stage, tag.

### 7. Backward Compatibility with Favorites
- The existing Favorite model and `/favorites` page should continue to work.
- AddToListButton is a NEW component that supplements (not replaces) FavoriteButton.
- Eventually favorites could migrate to a "default" list, but don't break the existing feature.

### 8. Build Must Pass
- `npm run build` with zero errors.
- `npx prisma generate && npx prisma db push` after schema changes.

---

## Technical Notes & Gotchas

- **Auth check pattern** for all API routes:
  ```typescript
  import { getServerSession } from "next-auth";
  import { authOptions } from "@/lib/auth";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  ```

- **Next.js 16 params** are Promises:
  ```typescript
  export async function GET(
    _request: Request,
    { params }: { params: Promise<{ listId: string }> }
  ) {
    const { listId } = await params;
  }
  ```

  For nested dynamic routes like `/api/lists/[listId]/entries/[entryId]`:
  ```typescript
  { params }: { params: Promise<{ listId: string; entryId: string }> }
  ```

- **Stage as a string** (not enum) for flexibility. Validate against the allowed list in the API route:
  ```typescript
  const VALID_STAGES = ["identified", "enriched", "contacted", "replied", "interested", "passed"];
  if (stage && !VALID_STAGES.includes(stage)) {
    return Response.json({ error: "Invalid stage" }, { status: 400 });
  }
  ```

- **Tag suggestions query:**
  ```typescript
  const existingTags = await prisma.candidateTag.findMany({
    where: { entry: { list: { userId } } },
    select: { tag: true },
    distinct: ['tag'],
  });
  ```

- **List entry count query:**
  ```typescript
  const lists = await prisma.candidateList.findMany({
    where: { userId },
    include: { _count: { select: { entries: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  ```

- **Prisma nested includes** for list detail view:
  ```typescript
  const list = await prisma.candidateList.findUnique({
    where: { id: listId, userId },
    include: {
      entries: {
        include: {
          developer: {
            include: { languages: { take: 3, orderBy: { percentage: 'desc' } } }
          },
          tags: true,
          notes: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { addedAt: 'desc' },
      },
    },
  });
  ```

- **Schema changes:** After modifying `prisma/schema.prisma`, run `npx prisma generate && npx prisma db push`.

- **The AddToListButton** should fetch the user's lists on mount (or on click) and cache them. Don't fetch on every render. Use a simple `useState` + `useEffect` pattern, or React's `use()` with a promise.

- **Stage colors** for the UI:
  ```typescript
  const STAGE_COLORS: Record<string, string> = {
    identified: "bg-neutral-100 text-neutral-700",
    enriched: "bg-blue-100 text-blue-700",
    contacted: "bg-yellow-100 text-yellow-700",
    replied: "bg-purple-100 text-purple-700",
    interested: "bg-green-100 text-green-700",
    passed: "bg-red-100 text-red-700",
  };
  ```
