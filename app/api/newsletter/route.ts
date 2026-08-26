import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/drizzle/db'
import { newsletterSubscribers } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  email: z.string().email('E-mail inválido').max(200),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    const { email } = parsed.data

    const existing = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1)

    // Resposta sempre igual, inscrito ou não. Responder diferente para e-mail
    // já cadastrado transformaria esta rota pública num consultor de quem está
    // na lista, bastando testar endereços um a um.
    if (existing.length > 0) {
      if (existing[0].status !== 'active') {
        await db
          .update(newsletterSubscribers)
          .set({ status: 'active', subscribed_at: new Date(), unsubscribed_at: null })
          .where(eq(newsletterSubscribers.email, email))
      }
      return NextResponse.json({ ok: true })
    }

    await db.insert(newsletterSubscribers).values({ email })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
