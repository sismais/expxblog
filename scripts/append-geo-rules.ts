/**
 * Acrescenta as regras de estrutura GEO aos prompts já gravados em agent_configs.
 *
 * Uso: npx tsx scripts/append-geo-rules.ts
 *
 * Os prompts do banco foram escritos à mão e têm a voz do blog. O script NÃO
 * sobrescreve: ele adiciona um bloco no fim, e é idempotente — se o marcador já
 * estiver lá, pula. O valor anterior é impresso antes de qualquer escrita.
 */
import 'dotenv/config'
import { db } from '../drizzle/db'
import { agentConfigs } from '../drizzle/schema'
import { eq } from 'drizzle-orm'
import { GEO_STRUCTURE_RULES, GEO_REVIEW_CRITERIA } from '../lib/agents/types'

const MARKER = '<!-- geo-v1 -->'

const HEADLINE_RULES = `TÍTULO QUE A PESSOA PROCURA: escreva o título como a pergunta ou a dúvida real que o dono do comércio digitaria na busca ou perguntaria para um assistente. Nada de trocadilho, promessa ou título de efeito. Quando couber, comece por "Como", "Quanto", "Preciso de", "Vale a pena", "O que acontece se".`

const BLOCKS: Record<string, string> = {
  copywriter: GEO_STRUCTURE_RULES,
  reviewer: GEO_REVIEW_CRITERIA,
  headline: HEADLINE_RULES,
}

async function main() {
  for (const [id, block] of Object.entries(BLOCKS)) {
    const [row] = await db.select().from(agentConfigs).where(eq(agentConfigs.id, id)).limit(1)

    if (!row) {
      console.log(`\n[${id}] não existe em agent_configs, pulando (o fallback do código já cobre).`)
      continue
    }

    if (row.prompt.includes(MARKER)) {
      console.log(`\n[${id}] já tem o bloco GEO, pulando.`)
      continue
    }

    console.log(`\n[${id}] prompt atual tem ${row.prompt.length} caracteres. Acrescentando bloco GEO.`)

    const novoPrompt = `${row.prompt.trimEnd()}\n\n${MARKER}\n${block}`

    await db
      .update(agentConfigs)
      .set({ prompt: novoPrompt, updated_at: new Date() })
      .where(eq(agentConfigs.id, id))

    console.log(`[${id}] gravado, agora com ${novoPrompt.length} caracteres.`)
  }

  console.log('\nPronto.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Falhou:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
