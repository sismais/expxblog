import { NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { posts } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getAppUrl } from '@/lib/app-url'
import { signPreviewToken } from '@/lib/jwt'

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

  // Token curto (10 min), assinado com chave própria de preview — nunca vale
  // como cookie de sessão do admin.
  const token = await signPreviewToken(postId)

  const baseUrl = getAppUrl()
  const url = `${baseUrl}/preview/${postId}?token=${token}`

  return NextResponse.json({ token, url })
}
