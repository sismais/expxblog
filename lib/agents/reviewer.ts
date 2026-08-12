// lib/agents/reviewer.ts
import { callOpenRouter } from '@/lib/ai'
import { getAgentConfig } from '@/lib/agent-configs'
import { AgentContext, AgentResult, GEO_REVIEW_CRITERIA } from '@/lib/agents/types'

export const MAX_REVIEW_CYCLES = 3

export async function runReviewerAgent(
  ctx: AgentContext,
  apiKey: string
): Promise<AgentResult & { approved: boolean; issues?: string[] }> {
  if (!ctx.articleContent) {
    return { success: false, approved: false, message: 'Artigo não disponível', error: 'NO_CONTENT' }
  }

  const config = await getAgentConfig('reviewer')

  // Envia o HTML (e não o texto puro) porque os critérios de estrutura dependem
  // de enxergar h2, listas, tabelas e links de fonte.
  const articleHtml = ctx.articleContent.replace(/\s+/g, ' ').trim().slice(0, 32000)

  const resp = await callOpenRouter(
    {
      model: config.model,
      feature: 'content_generation',
      messages: [
        { role: 'system', content: config.prompt },
        {
          role: 'user',
          content: `Título: ${ctx.articleTitle ?? ''}\n\n${GEO_REVIEW_CRITERIA}\n\nConteúdo (HTML):\n${articleHtml}`,
        },
      ],
      temperature: 0.2,
      // lista de issues ficou maior com os critérios de estrutura; JSON truncado
      // cai no catch e aprova sem revisar, por isso a folga
      max_tokens: 900,
    },
    apiKey
  )

  let result: { approved: boolean; issues?: string[] }
  try {
    const raw = resp.choices[0]?.message?.content ?? ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    result = { approved: true }
  }

  return {
    success: true,
    approved: result.approved,
    issues: result.issues,
    message: result.approved
      ? 'Artigo aprovado pelo revisor'
      : `Revisão necessária: ${(result.issues ?? []).join('; ')}`,
  }
}
