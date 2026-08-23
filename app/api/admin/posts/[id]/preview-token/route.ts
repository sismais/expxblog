import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { db } from '@/drizzle/db'
import { posts } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAppUrl } from '@/lib/app-url'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-must-change-in-prod-32chars'
)

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const postId = parseInt(params.id, 10)
  if (isNaN(postId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Verifica se o post existe
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1)
  if (!post) {
    return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 })
  }

  // Gera token JWT curto (10 minutos)
  const token = await new SignJWT({ sub: String(postId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret)

  const baseUrl = getAppUrl()
  const url = `${baseUrl}/preview/${postId}?token=${token}`

  return NextResponse.json({ token, url })
}
