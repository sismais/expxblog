import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { runAutomationCycle } from '@/lib/automation'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAutomationCycle(false, 'schedule')
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('[Cron] Automation cycle failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
