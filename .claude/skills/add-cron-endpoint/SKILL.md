---
name: add-cron-endpoint
description: >
  Use when creating a new scheduled/cron task in the ExpxBlog project.
  Enforces the project's cron pattern: pg_cron + pg_net on Supabase (never
  vercel.json cron), Bearer auth with SUPABASE_SERVICE_ROLE_KEY, maxDuration 300,
  and logging to automation_logs. Prevents the most common LLM mistake: using
  Vercel's native cron instead of the project's Supabase-based cron.
---

# Skill: Add Cron Endpoint

## When to use

Trigger this skill when any of the following is true:
- Creating a new scheduled/periodic task
- The prompt mentions "cron", "agendamento", "scheduled task", "job periódico", "executar automaticamente a cada X horas"
- You are about to add a `crons` entry to `vercel.json` — STOP, that is wrong for this project

## When NOT to use

- Modifying the logic inside an existing cron endpoint (authentication and structure are already in place)
- One-off background jobs not triggered by a schedule
- Admin-triggered manual runs (those use `/api/admin/*/run` routes, not cron routes)

---

## The Core Rule

**Crons in this project run as pg_cron jobs in Supabase that call the Next.js API via pg_net HTTP requests.**

Never add crons to `vercel.json`. Never use Vercel's native cron scheduling. The only correct pattern is:
1. Create the API route in `app/api/cron/`
2. Protect it with `SUPABASE_SERVICE_ROLE_KEY`
3. Register the pg_cron job in Supabase (SQL)

---

## Step-by-step checklist

### 1. Create the API route

Create `app/api/cron/<name>/route.ts`. The structure is always the same:

```typescript
// app/api/cron/my-task/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300  // required — limite do plano Hobby da Vercel

export async function POST(request: NextRequest) {
  // 1. Authenticate with SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('authorization')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. Run the task
    const result = await runMyTask()
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[Cron] my-task failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

Always `POST`, never `GET`. Always `maxDuration = 300`.

### 2. Implement the task logic in `lib/`

Keep the route thin. Put the real logic in `lib/`:

```typescript
// lib/my-task.ts
export async function runMyTask(): Promise<{ ok: boolean; processed: number }> {
  // ... task logic ...
  return { ok: true, processed: 0 }
}
```

Existing examples: `lib/automation.ts`, `lib/rss-automation.ts`, `lib/source-crawlers/runner.ts`.

### 3. Log execution to `automation_logs` (when applicable)

If the task generates posts or runs a significant pipeline, log to `automation_logs`:

```typescript
import { db } from '@/drizzle/db'
import { automationLogs } from '@/drizzle/schema'

const startedAt = Date.now()
let postId: number | null = null
let errorMsg: string | null = null

try {
  const result = await runMyTask()
  postId = result.postId ?? null
} catch (err) {
  errorMsg = err instanceof Error ? err.message : 'unknown'
} finally {
  await db.insert(automationLogs).values({
    trigger:    'schedule',
    status:     errorMsg ? 'error' : 'success',
    duration_ms: Date.now() - startedAt,
    post_id:    postId,
    error:      errorMsg,
  })
}
```

### 4. Register the pg_cron job in Supabase

Run this SQL in the Supabase SQL editor (not in code — this is a one-time DB operation):

```sql
-- Schedule: every 6 hours. Adjust cron expression as needed.
SELECT cron.schedule(
  'my-task-cron',                          -- job name (unique)
  '0 */6 * * *',                           -- cron expression
  $$
    SELECT net.http_post(
      url     := 'https://your-app.vercel.app/api/cron/my-task',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);
```

To store the service role key as a Supabase setting (do once):
```sql
ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key-here';
```

Common cron expressions:
- Every hour: `'0 * * * *'`
- Every 6 hours: `'0 */6 * * *'`
- Every day at 3am: `'0 3 * * *'`
- Every 30 minutes: `'*/30 * * * *'`

### 5. Set the environment variable

Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (production + preview):

```bash
# Check current env vars
vercel env ls

# Add if missing (will prompt for value)
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

Or add via Vercel dashboard → Project → Settings → Environment Variables.

---

## What NOT to do

```jsonc
// ❌ NEVER — vercel.json cron
{
  "crons": [
    { "path": "/api/cron/my-task", "schedule": "0 */6 * * *" }
  ]
}

// ❌ NEVER — GET handler for cron
export async function GET(request: NextRequest) { ... }

// ❌ NEVER — missing auth check
export async function POST(request: NextRequest) {
  const result = await runMyTask()  // anyone can trigger this!
  return NextResponse.json(result)
}

// ❌ NEVER — missing maxDuration (will timeout at 60s default)
export async function POST(request: NextRequest) { ... }
// missing: export const maxDuration = 300
```

---

## Existing cron routes (reference)

| Route | Lib function | Trigger |
|---|---|---|
| `app/api/cron/automation/route.ts` | `lib/automation.ts` → `runAutomationCycle()` | pg_cron |
| `app/api/cron/rss/route.ts` | `lib/rss-automation.ts` | pg_cron |
| `app/api/cron/source-crawlers/route.ts` | `lib/source-crawlers/runner.ts` | pg_cron |

Use these as reference when implementing a new cron route.

---

## Verification before finishing

- [ ] Route is in `app/api/cron/<name>/route.ts`
- [ ] `export const maxDuration = 300` is present
- [ ] Auth guard checks `SUPABASE_SERVICE_ROLE_KEY` as Bearer token
- [ ] Handler is `POST`, not `GET`
- [ ] Task logic is in `lib/`, not inlined in the route
- [ ] Errors are caught and returned as JSON `{ error: string }` with status 500
- [ ] pg_cron SQL provided to the user (this is a manual DB step)
- [ ] `vercel.json` was NOT modified
