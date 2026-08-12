import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/app-url'

/**
 * Existem dois tipos de bot de IA e eles fazem coisas diferentes:
 *
 * 1. Bot de treino (GPTBot, ClaudeBot, CCBot, Bytespider): baixa o conteúdo
 *    para treinar modelo. Não gera visita nem citação de volta.
 * 2. Bot de busca em tempo real (OAI-SearchBot, ChatGPT-User, Claude-User,
 *    Claude-SearchBot, PerplexityBot): busca a página na hora que alguém
 *    pergunta e cita a fonte com link.
 *
 * Decisão atual: liberar os dois. Os de busca estão listados um a um abaixo
 * porque queremos ser citados e isso precisa estar explícito, não implícito
 * na regra `*`. Os de treino não estão bloqueados — se um dia a decisão mudar,
 * é aqui que entra o `disallow: '/'` para eles.
 */
const AI_SEARCH_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
]

const SEARCH_ENGINE_BOTS = ['Googlebot', 'Bingbot']

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/setup'],
      },
      ...[...SEARCH_ENGINE_BOTS, ...AI_SEARCH_BOTS].map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/admin', '/api/', '/setup'],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
