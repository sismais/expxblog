const WORDS_PER_MINUTE = 200

/**
 * Tempo de leitura em minutos a partir do HTML do artigo.
 * Sempre devolve no mínimo 1 para não exibir "0 min de leitura".
 */
export function readingTimeMinutes(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 1
  return Math.max(1, Math.round(text.split(' ').length / WORDS_PER_MINUTE))
}

export function readingTimeLabel(html: string): string {
  return `${readingTimeMinutes(html)} min de leitura`
}

/** Nome anterior da mesma função, usado pelos cards dos templates portal/news/tech. */
export const estimateReadingTime = readingTimeMinutes
