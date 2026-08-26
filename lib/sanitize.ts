import sanitizeHtml from 'sanitize-html'

/**
 * Preset único de sanitização do corpo de artigo.
 *
 * Antes esse objeto estava copiado em dez arquivos, e uma das cópias
 * (lib/agents/publisher.ts) já tinha divergido dos outros nove. Como é a barreira
 * de XSS de tudo que entra em posts.content — TipTap, saída de IA, importação de
 * URL e a API v1 — cópia que envelhece sozinha vira buraco.
 *
 * `a` inclui `rel` de propósito: link com target="_blank" precisa poder trazer
 * rel="noopener". Era a diferença que o publisher tinha a mais.
 */
export const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h2', 'h3', 'img']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt'],
  },
}

/** Sanitiza HTML de artigo com o preset do projeto. */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, sanitizeOptions)
}
