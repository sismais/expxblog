import { db } from '@/drizzle/db'
import { automationConfig, automationLogs, siteSettings } from '@/drizzle/schema'
import { createPipelineStream } from '@/lib/agent-pipeline'
import type { PipelineEvent } from '@/lib/agents/types'
import { eq } from 'drizzle-orm'

export type AutomationResult = {
  success: boolean
  message: string
  post_id?: number
  skipped?: boolean
  image_error?: string
}

export async function getOrCreateAutomationConfig() {
  const rows = await db.select().from(automationConfig).limit(1)
  if (rows.length > 0) return rows[0]
  const [row] = await db.insert(automationConfig).values({}).returning()
  return row
}

export async function runAutomationCycle(
  force = false,
  triggeredBy: 'schedule' | 'manual' = 'schedule'
): Promise<AutomationResult> {
  const config = await getOrCreateAutomationConfig()

  if (!config.enabled) {
    const result: AutomationResult = { success: false, skipped: true, message: 'Automação desabilitada' }
    await writeLog({ triggeredBy, status: 'skipped', message: result.message, durationMs: 0 })
    return result
  }

  if (!force && config.next_run_at && new Date() < new Date(config.next_run_at)) {
    const result: AutomationResult = { success: false, skipped: true, message: 'Ainda não está na hora de executar' }
    await writeLog({ triggeredBy, status: 'skipped', message: result.message, durationMs: 0 })
    return result
  }

  const startedAt = Date.now()

  let themeIds: number[] = []
  try {
    themeIds = JSON.parse(config.theme_ids)
    if (!Array.isArray(themeIds)) themeIds = []
  } catch {}

  try {
    // Lê configuração de publicação da automação (default: draft)
    let publishStatus: 'draft' | 'published' = 'draft'
    try {
      const rows = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, 'automation_publish_status')).limit(1)
      if (rows.length > 0 && (rows[0].value === 'draft' || rows[0].value === 'published')) {
        publishStatus = rows[0].value
      }
    } catch {
      // Em caso de erro, mantém o default 'draft'
    }

    const stream = createPipelineStream({
      themeIds,
      triggers: { publishStatus },
    })

    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lastEvent: PipelineEvent | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.replace(/^data: /, '').trim()
        if (!line) continue
        try {
          lastEvent = JSON.parse(line) as PipelineEvent
        } catch {}
      }
    }

    const durationMs = Date.now() - startedAt

    if (!lastEvent) {
      const message = 'Pipeline não retornou resultado'
      await writeLog({ triggeredBy, status: 'error', message, error: message, durationMs })
      await updateNextRun(config.id, config.interval_hours)
      return { success: false, message }
    }

    if (lastEvent.type === 'pipeline_done') {
      const postId = lastEvent.data?.post_id as number | undefined
      await writeLog({ triggeredBy, status: 'success', message: lastEvent.message, postId, durationMs })
      await updateNextRun(config.id, config.interval_hours)
      return { success: true, message: lastEvent.message, post_id: postId }
    }

    await writeLog({ triggeredBy, status: 'error', message: lastEvent.message, error: lastEvent.message, durationMs })
    await updateNextRun(config.id, config.interval_hours)
    return { success: false, message: lastEvent.message }
  } catch (err) {
    const durationMs = Date.now() - startedAt
    const errorMsg = err instanceof Error ? err.message : String(err)
    await writeLog({ triggeredBy, status: 'error', message: 'Erro inesperado na automação', error: errorMsg, durationMs })
    await updateNextRun(config.id, config.interval_hours)
    throw err
  }
}

async function writeLog(params: {
  triggeredBy: 'schedule' | 'manual'
  status: 'skipped' | 'success' | 'error'
  message: string
  durationMs: number
  postId?: number
  error?: string
}) {
  const startedAt = new Date(Date.now() - params.durationMs)
  const finishedAt = new Date()
  await db.insert(automationLogs).values({
    triggered_by: params.triggeredBy,
    status: params.status,
    message: params.message,
    post_id: params.postId ?? null,
    error: params.error ?? null,
    duration_ms: params.durationMs,
    started_at: startedAt,
    finished_at: finishedAt,
  })
}

async function updateNextRun(configId: number, intervalHours: number) {
  await db.update(automationConfig).set({
    last_run_at: new Date(),
    next_run_at: new Date(Date.now() + intervalHours * 60 * 60 * 1000),
  }).where(eq(automationConfig.id, configId))
}
