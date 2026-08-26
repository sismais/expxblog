import { NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { apiTokens } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

function parseId(id: string): number | null {
  const n = parseInt(id, 10)
  return isNaN(n) || n <= 0 ? null : n
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json()
    const active = body.active === true ? 'true' : body.active === false ? 'false' : null
    if (!active) {
      return NextResponse.json({ error: 'Campo "active" (boolean) obrigatório' }, { status: 400 })
    }

    // `.returning()` sem colunas traria o token em claro de volta pro cliente,
    // e o `token` daqui alimenta a mesma linha da listagem — tem que vir no
    // formato mascarado.
    const [updated] = await db
      .update(apiTokens)
      .set({ active })
      .where(eq(apiTokens.id, id))
      .returning({
        id: apiTokens.id,
        name: apiTokens.name,
        token: apiTokens.token_preview,
        active: apiTokens.active,
        last_used_at: apiTokens.last_used_at,
        created_at: apiTokens.created_at,
      })

    if (!updated) {
      return NextResponse.json({ error: 'Token não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ token: updated })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseId(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const existing = await db.select().from(apiTokens).where(eq(apiTokens.id, id)).limit(1)
    if (!existing.length) {
      return NextResponse.json({ error: 'Token não encontrado' }, { status: 404 })
    }

    await db.delete(apiTokens).where(eq(apiTokens.id, id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
