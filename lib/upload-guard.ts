/**
 * Validação de imagem por conteúdo, não pelo que o cliente declara.
 *
 * `file.type` vem do Content-Type da parte do multipart e a extensão vem do
 * nome do arquivo — os dois são escolhidos por quem envia. Como o bucket
 * `uploads` é público, um arquivo aceito no palpite vira conteúdo servido a
 * partir de *.supabase.co com o tipo que o atacante quiser.
 */

export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/svg+xml'

const EXT_BY_KIND: Record<ImageKind, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
}

/** Extensão derivada do tipo detectado — nunca do nome que veio do cliente. */
export function extensionFor(kind: ImageKind): string {
  return EXT_BY_KIND[kind]
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b)
}

/**
 * Detecta o tipo pelos magic bytes. SVG não tem assinatura binária, então é
 * reconhecido por ser texto começando com `<?xml` ou `<svg` (ignorando BOM,
 * espaço e comentário na frente).
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'
  }

  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, 1024))
    .replace(/^﻿/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trimStart()
  if (head.startsWith('<?xml') || head.startsWith('<svg')) return 'image/svg+xml'

  return null
}

/**
 * SVG é XML executável: aceita <script>, atributo de evento e href
 * `javascript:`. Servido inline a partir do bucket público, isso é XSS na
 * origem do storage, com acesso ao que estiver lá.
 *
 * Recusa em vez de tentar limpar. Logo legítimo não usa nada disto, e remover
 * trecho de XML na marra costuma deixar passar variação com entidade e
 * codificação. Devolve o motivo, ou null quando o arquivo está limpo.
 */
export function svgRejectionReason(svg: string): string | null {
  const normalized = svg.replace(/\s+/g, ' ').toLowerCase()

  if (/<\s*script/.test(normalized)) return 'SVG com <script> não é aceito'
  if (/<\s*foreignobject/.test(normalized)) return 'SVG com <foreignObject> não é aceito'
  if (/<!entity/.test(normalized)) return 'SVG com entidade externa não é aceito'
  if (/\son[a-z]+\s*=/.test(normalized)) return 'SVG com atributo de evento não é aceito'
  if (/(javascript|vbscript)\s*:/.test(normalized)) return 'SVG com link de script não é aceito'
  if (/<\s*(iframe|embed|object|use\b[^>]*https?:)/.test(normalized)) {
    return 'SVG com conteúdo externo não é aceito'
  }

  return null
}

/**
 * Porteiro único do upload. Recebe os bytes crus e devolve o tipo confirmado
 * mais a extensão, ou uma mensagem pronta para o usuário.
 */
export function inspectImage(
  bytes: Uint8Array
): { ok: true; kind: ImageKind; ext: string } | { ok: false; error: string } {
  const kind = detectImageKind(bytes)
  if (!kind) {
    return { ok: false, error: 'Formato não suportado. Use JPG, PNG, WebP, GIF ou SVG.' }
  }

  if (kind === 'image/svg+xml') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    const reason = svgRejectionReason(text)
    if (reason) return { ok: false, error: reason }
  }

  return { ok: true, kind, ext: extensionFor(kind) }
}
