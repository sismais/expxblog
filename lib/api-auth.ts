import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { apiTokens } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export async function verifyApiToken(request: NextRequest): Promise<{ valid: true; tokenId: number } | { valid: false; response: NextResponse }> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Token de API ausente. Envie o header Authorization: Bearer <token>' },
        { status: 401 }
      ),
    }
  }

  // Busca pelo hash, não pelo valor. Assim o texto puro deixa de ser
  // necessário no banco, e nenhuma consulta precisa carregá-lo.
  const [found] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.token_hash, hashApiToken(token)))
    .limit(1)

  if (!found || found.active !== 'true') {
    return {
      valid: false,
      response: NextResponse.json({ error: 'Token de API inválido ou desativado' }, { status: 401 }),
    }
  }

  await db
    .update(apiTokens)
    .set({ last_used_at: new Date() })
    .where(eq(apiTokens.id, found.id))

  return { valid: true, tokenId: found.id }
}

export function generateApiToken(): string {
  return `blog_${crypto.randomBytes(32).toString('hex')}`
}

/** SHA-256 do token. É o que fica no banco, no lugar do valor em claro. */
export function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Trecho exibido na listagem: início e fim, o miolo coberto. */
export function previewApiToken(token: string): string {
  if (token.length <= 12) return '••••••••'
  return `${token.slice(0, 8)}••••••••••••${token.slice(-4)}`
}
