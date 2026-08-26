import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle/db'
import { apiTokens } from '@/drizzle/schema'
import { desc } from 'drizzle-orm'
import { generateApiToken, hashApiToken, previewApiToken } from '@/lib/api-auth'

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
})

export async function GET() {
  try {
    // Devolve só o preview. Antes vinha o bearer completo de todos os tokens
    // em toda listagem, então qualquer leitura indevida do painel levava as
    // integrações junto.
    const all = await db
      .select({
        id: apiTokens.id,
        name: apiTokens.name,
        token: apiTokens.token_preview,
        active: apiTokens.active,
        last_used_at: apiTokens.last_used_at,
        created_at: apiTokens.created_at,
      })
      .from(apiTokens)
      .orderBy(desc(apiTokens.created_at))

    return NextResponse.json({ tokens: all })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const token = generateApiToken()
    const [created] = await db
      .insert(apiTokens)
      .values({
        name: parsed.data.name,
        token,
        token_hash: hashApiToken(token),
        token_preview: previewApiToken(token),
      })
      .returning({
        id: apiTokens.id,
        name: apiTokens.name,
        active: apiTokens.active,
        last_used_at: apiTokens.last_used_at,
        created_at: apiTokens.created_at,
      })

    // Única vez que o valor completo sai do servidor — a tela já avisa para
    // copiar agora.
    return NextResponse.json({ token: { ...created, token } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
