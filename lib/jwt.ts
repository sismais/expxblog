import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

/**
 * Fonte única do segredo de assinatura. Vive aqui, e não em lib/auth.ts,
 * porque este módulo roda no Edge (middleware.ts) e não pode puxar bcrypt.
 *
 * Preguiçoso de propósito: um throw no topo do módulo quebraria o
 * `next build` na fase de coleta de rotas, e o wizard de instalação grava o
 * JWT_SECRET na Vercel só DEPOIS do primeiro deploy — o build travaria antes
 * do /setup existir. Mesmo motivo do Proxy preguiçoso em drizzle/db.ts.
 */
function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET ausente ou com menos de 32 caracteres')
  }
  return new TextEncoder().encode(raw)
}

/**
 * Chave separada para o link de pré-visualização, derivada do JWT_SECRET.
 *
 * Antes o preview era assinado com o MESMO segredo do cookie de sessão, então
 * bastava colar o token do link em `auth_token` para ter o painel inteiro por
 * 10 minutos. Com chave derivada o cruzamento fica impossível, sem depender de
 * alguém lembrar de conferir claim. Só Node usa isso; o Edge nunca chama.
 */
async function getPreviewSecret(): Promise<Uint8Array> {
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET ausente ou com menos de 32 caracteres')
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${raw}:preview`)
  )
  return new Uint8Array(digest)
}

export interface TokenPayload extends JWTPayload {
  userId: number
  email: string
  role: string
}

export async function signToken(payload: {
  userId: number
  email: string
  role: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    // `userId` numérico é o que separa uma sessão real de qualquer outro token
    // assinado com este segredo. Vem de users.id, que é `serial` em
    // drizzle/schema.ts — virando bigint um dia, o postgres-js passa a devolver
    // string e esta checagem precisa acompanhar.
    if (typeof payload.userId !== 'number') return null
    return payload as TokenPayload
  } catch {
    // Cai aqui também quando JWT_SECRET falta: falha fechada, sem 500 em loop.
    return null
  }
}

/** Token de leitura de um rascunho específico. Não vale como sessão. */
export async function signPreviewToken(postId: number): Promise<string> {
  return new SignJWT({ sub: String(postId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(await getPreviewSecret())
}

/** Devolve o id do post que o token libera, ou null se não valer. */
export async function verifyPreviewToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, await getPreviewSecret())
    const postId = parseInt(String(payload.sub), 10)
    return isNaN(postId) ? null : postId
  } catch {
    return null
  }
}
