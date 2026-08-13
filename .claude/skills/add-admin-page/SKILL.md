---
name: add-admin-page
description: >
  Use when creating a new page or section in the ExpxBlog admin dashboard.
  Enforces the project's strict admin pattern: page.tsx is a thin Server Component
  shell, all UI logic goes in a *Client.tsx Client Component, and all data access
  goes through /api/admin/* routes (never direct Drizzle queries in admin pages).
  Also covers adding the nav link to the sidebar.
---

# Skill: Add Admin Page

## When to use

Trigger this skill when any of the following is true:
- Creating a new page under `app/admin/`
- Adding a new section to the admin dashboard
- The prompt mentions "nova página admin", "novo CRUD no admin", "nova seção no dashboard"
- You are about to add a Drizzle import to an `app/admin/` page — STOP and use this skill

## When NOT to use

- Modifying an existing admin page that already follows the pattern
- Adding API routes under `app/api/admin/` (no page involved)
- Changes to `app/(public)/` — that route group uses direct Drizzle queries in Server Components, which is the OPPOSITE of the admin pattern

---

## The Core Rule

**Admin pages NEVER query the database directly.**

Unlike `app/(public)/` which uses Drizzle in Server Components, admin pages are Client Components that fetch from `/api/admin/*`. This is intentional: the API layer enforces JWT authentication via middleware.

```
app/(public)/page.tsx       → Server Component → direct Drizzle query ✅
app/admin/my-page/page.tsx  → Server Component shell → renders <MyPageClient />
app/admin/my-page/MyPageClient.tsx → 'use client' → fetch('/api/admin/my-resource')
```

---

## Step-by-step checklist

### 1. Create the directory and page shell

```
app/admin/my-page/
  page.tsx          ← thin Server Component, just renders the Client
  MyPageClient.tsx  ← 'use client', all UI and data fetching here
```

**`app/admin/my-page/page.tsx`** — always this exact pattern:

```typescript
import MyPageClient from './MyPageClient'

export default function MyPage() {
  return <MyPageClient />
}
```

No imports from `drizzle`, `db`, or any server-only module. No `async`, no `await`.

### 2. Create the Client Component

**`app/admin/my-page/MyPageClient.tsx`**:

```typescript
'use client'

import { useState, useEffect } from 'react'

interface MyResource {
  id: number
  name: string
  // ... fields matching the API response
}

interface Toast { type: 'success' | 'error'; msg: string }

export default function MyPageClient() {
  const [items, setItems]   = useState<MyResource[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast]   = useState<Toast | null>(null)

  const showToast = (type: Toast['type'], msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetch('/api/admin/my-resource')
      .then(r => r.json())
      .then(data => setItems(data.items ?? data))
      .catch(() => showToast('error', 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [])

  // ... rest of the UI
}
```

Follow the visual conventions from existing pages:
- Use `brand-primary` (`#1A4FA0`) for primary actions
- Use `brand-secondary` (`#F58A2D`) for accents/highlights  
- Inter font for UI, Source Serif 4 for article content
- Loading states with skeleton or spinner
- Toast notifications for feedback (not browser alerts)

### 3. Create the API route(s)

Create `app/api/admin/my-resource/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { myTable } from '@/drizzle/schema'

// No auth check needed here — middleware.ts handles it for all /api/admin/* routes

export async function GET(request: NextRequest) {
  try {
    const items = await db.select().from(myTable).orderBy(myTable.createdAt)
    return NextResponse.json(items)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // validate body...
    const [created] = await db.insert(myTable).values(body).returning()
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

For per-item routes, create `app/api/admin/my-resource/[id]/route.ts` with `GET`, `PUT`/`PATCH`, `DELETE`.

**You do NOT need to add auth checks** — `middleware.ts` already protects all `/api/admin/*` paths and injects `x-user-id` and `x-user-email` headers.

### 4. Add the nav link to the sidebar

Open `app/admin/layout.tsx` and add an entry to the `navItems` array:

```typescript
const navItems = [
  // ... existing items ...
  {
    href: '/admin/my-page',
    label: 'Minha Seção',   // Portuguese label
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {/* SVG path for the icon */}
        <path d="..." />
      </svg>
    ),
  },
]
```

Use a relevant icon from the Feather Icons set (same style used throughout: 17×17, strokeWidth 1.75, strokeLinecap/Join round).

### 5. Schema changes (if needed)

If the feature requires a new DB table, add it to `drizzle/schema.ts` and run:

```bash
npm run db:push       # aplica o schema no banco
# e espelhe a tabela em drizzle/setup-sql.ts
```

---

## Pattern comparison: admin vs. public

| | `app/(public)/` | `app/admin/` |
|---|---|---|
| Component type | Server Component | Client Component (`'use client'`) |
| Data access | Direct Drizzle import | `fetch('/api/admin/...')` |
| Auth | Public (no auth) | Via middleware JWT check |
| Mutations | N/A | Via `fetch` POST/PUT/DELETE |

---

## Example: complete new "Comentários" section

**`app/admin/comentarios/page.tsx`**:
```typescript
import ComentariosClient from './ComentariosClient'
export default function ComentariosPage() {
  return <ComentariosClient />
}
```

**`app/admin/comentarios/ComentariosClient.tsx`**:
```typescript
'use client'
import { useState, useEffect } from 'react'

export default function ComentariosClient() {
  const [comentarios, setComentarios] = useState([])
  useEffect(() => {
    fetch('/api/admin/comentarios').then(r => r.json()).then(setComentarios)
  }, [])
  return <div>{/* UI */}</div>
}
```

**`app/api/admin/comentarios/route.ts`**:
```typescript
import { NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { comentarios } from '@/drizzle/schema'
export async function GET() {
  const items = await db.select().from(comentarios)
  return NextResponse.json(items)
}
```

**`app/admin/layout.tsx`** — add to `navItems`:
```typescript
{ href: '/admin/comentarios', label: 'Comentários', icon: <svg>...</svg> }
```

---

## Verification before finishing

- [ ] `page.tsx` has no Drizzle imports, no async/await, only renders the Client component
- [ ] `*Client.tsx` starts with `'use client'` directive
- [ ] All data fetching uses `fetch('/api/admin/...')`, not Drizzle directly
- [ ] API route is under `app/api/admin/` (not `app/api/`) so middleware protects it
- [ ] Nav link added to `navItems` in `app/admin/layout.tsx`
- [ ] Schema migration run if new table was added
- [ ] `npm run build` passes (no TS errors)
