import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/drizzle/db'
import { pageViews, posts } from '@/drizzle/schema'
import { eq, and, gte } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, referrer } = body

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    if (path.startsWith('/admin') || path.startsWith('/api')) {
      return NextResponse.json({ ok: true })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const fingerprint = `${ip}-${path}`
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const recent = await db
      .select({ id: pageViews.id })
      .from(pageViews)
      .where(
        and(
          eq(pageViews.ip, fingerprint),
          gte(pageViews.visited_at, fiveMinutesAgo),
          eq(pageViews.path, path)
        )
      )
      .limit(1)

    if (recent.length > 0) {
      return NextResponse.json({ ok: true, deduplicated: true })
    }

    let postId: number | null = null
    let postSlug: string | null = null
    let postTitle: string | null = null

    const segments = path.split('/').filter(Boolean)
    if (segments.length === 1 && !['busca'].includes(segments[0])) {
      const slug = segments[0]
      const postResult = await db
        .select({ id: posts.id, slug: posts.slug, title: posts.title })
        .from(posts)
        .where(eq(posts.slug, slug))
        .limit(1)
      if (postResult.length > 0) {
        postId = postResult[0].id
        postSlug = postResult[0].slug
        postTitle = postResult[0].title
      }
    }

    await db.insert(pageViews).values({
      path,
      post_id: postId,
      post_slug: postSlug,
      post_title: postTitle,
      referrer: referrer || null,
      user_agent: request.headers.get('user-agent') || null,
      ip: fingerprint,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Rota pública e sem auth: a mensagem do erro fica no log, nunca na
    // resposta. Erro de banco cru descreve schema para quem estiver olhando.
    console.error('Track error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
