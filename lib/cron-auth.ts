import crypto from 'crypto'

/**
 * Autorização dos endpoints `/api/cron/*`, que rodam disparados pelo pg_cron
 * com a service role key no header.
 *
 * O bloco estava copiado nos três endpoints, comparando com `!==` — que sai no
 * primeiro byte diferente e, em tese, deixa medir o tempo para descobrir a
 * chave byte a byte. Aqui a comparação é de tempo constante.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return false

  const header = request.headers.get('authorization')
  if (!header) return false

  const esperado = Buffer.from(`Bearer ${serviceRoleKey}`)
  const recebido = Buffer.from(header)

  // timingSafeEqual exige mesmo tamanho, e o próprio tamanho não é segredo.
  if (esperado.length !== recebido.length) return false
  return crypto.timingSafeEqual(esperado, recebido)
}
