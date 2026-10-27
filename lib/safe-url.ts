import { lookup } from 'node:dns/promises'

/**
 * Guarda contra SSRF nas rotas que baixam uma URL informada pelo admin
 * (importação de design system e de logo).
 *
 * Sem isso, `fetch(url)` alcança o que o servidor alcança: banco interno,
 * localhost e, na nuvem, o endpoint de metadados em 169.254.169.254, que
 * entrega credencial de instância. Como essas rotas devolvem o conteúdo
 * baixado na resposta, o retorno vaza junto.
 *
 * Só roda em Node — depende de node:dns, que o Edge não tem.
 */

/** Faixas que nunca devem ser alcançadas a partir do servidor. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local, inclui o metadata da nuvem
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast e reservado
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase()
  if (addr === '::' || addr === '::1') return true
  if (addr.startsWith('fe80') || addr.startsWith('fc') || addr.startsWith('fd')) return true
  // IPv4 mapeado em IPv6 (::ffff:169.254.169.254) burlaria a checagem v4
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

/**
 * Devolve a URL validada, ou uma mensagem de erro pronta para o usuário.
 * Nunca lança.
 */
export async function checkPublicUrl(
  rawUrl: string
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'URL inválida' }
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Apenas URLs http/https são permitidas' }
  }

  const host = url.hostname.replace(/^\[|\]$/g, '')

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return { ok: false, error: 'Endereço interno não é permitido' }
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    return { ok: false, error: 'Não foi possível resolver o endereço' }
  }

  for (const { address, family } of addresses) {
    const priv = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address)
    if (priv) {
      return { ok: false, error: 'Endereço interno não é permitido' }
    }
  }

  return { ok: true, url }
}
