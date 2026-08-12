import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/app-url'
import { getPostsPage } from '@/lib/db-queries'
import { getSettings } from '@/lib/settings'

// llms.txt tem adoção baixa e o Google já disse que ignora o arquivo. Fica aqui
// porque é barato de manter e alguns agentes leem, não porque garante citação.

export const dynamic = 'force-dynamic'

/** Deixa o texto em uma linha só — markdown de lista quebra com \n no meio. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export async function GET() {
  try {
    const baseUrl = getAppUrl()
    const { company } = await getSettings()
    const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
    const blogDescription =
      oneLine(company.blog_description) || `Artigos publicados em ${baseUrl}`

    const { posts } = await getPostsPage({ limit: 50 })

    const lines = [
      `# ${oneLine(blogName)}`,
      '',
      `> ${blogDescription}`,
      '',
      '## Artigos',
      '',
      ...posts.map((post) => {
        const title = oneLine(post.title)
        const url = `${baseUrl}/${post.slug}`
        const excerpt = oneLine(post.excerpt)
        return excerpt ? `- [${title}](${url}): ${excerpt}` : `- [${title}](${url})`
      }),
      '',
    ]

    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    console.error('[/llms.txt]', err)
    return NextResponse.json({ error: 'Erro ao gerar llms.txt' }, { status: 500 })
  }
}
