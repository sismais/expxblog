import { NextRequest, NextResponse } from 'next/server'
import { aiChat } from '@/lib/ai'
import { db } from '@/drizzle/db'
import { posts } from '@/drizzle/schema'
import { generateSlug } from '@/lib/slug'
import sanitizeHtml from 'sanitize-html'
import { sanitizeOptions } from '@/lib/sanitize'


async function fetchUrlContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`Erro ao acessar URL (${response.status})`)
  }

  const html = await response.text()

  let text = html
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')

  const contentBlocks: string[] = []
  const blockRegex =
    /<(?:p|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li|blockquote)>/gi
  let match
  while ((match = blockRegex.exec(text)) !== null) {
    const blockText = match[1].replace(/<[^>]+>/g, '').trim()
    if (blockText.length > 20) {
      contentBlocks.push(blockText)
    }
  }

  const content = contentBlocks.join('\n\n')
  return content.slice(0, 15000)
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 })
    }

    let urlContent: string
    try {
      urlContent = await fetchUrlContent(url)
    } catch (err) {
      return NextResponse.json(
        {
          error: `Não foi possível acessar o link: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
        },
        { status: 400 }
      )
    }

    if (!urlContent || urlContent.length < 100) {
      return NextResponse.json(
        { error: 'O conteúdo do link é muito curto ou não pôde ser extraído' },
        { status: 400 }
      )
    }

    const prompt = `Você é um redator profissional especializado em conteúdo para blogs. Com base no conteúdo abaixo extraído de um artigo de referência, escreva um NOVO artigo original (não copie, reescreva com suas próprias palavras e adicione valor).

Conteúdo de referência:
---
${urlContent}
---

Requisitos:
- O artigo deve ser ORIGINAL, não uma cópia
- Pelo menos 800 palavras
- Use formatação HTML (h2, h3, p, strong, em, ul, ol, li, blockquote)
- Introdução envolvente, subtítulos bem estruturados, conclusão
- Informativo e otimizado para SEO
- Em português do Brasil

Responda com JSON válido (sem markdown, sem \`\`\`):
{
  "title": "título original do novo artigo",
  "excerpt": "resumo em até 160 caracteres",
  "content": "conteúdo HTML completo"
}`

    const result = await aiChat(
      'content_generation',
      [
        {
          role: 'system',
          content:
            'Você é um redator profissional. Reescreva e crie conteúdo original baseado em referências. Sempre responda em JSON válido, sem markdown.',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.8, max_tokens: 8000 }
    )

    let articleData: { title: string; excerpt: string; content: string }
    try {
      const cleaned = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      articleData = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[generate-from-url] JSON parse failed:', parseErr)
      console.error('[generate-from-url] AI raw response (first 500):', result?.slice(0, 500))
      return NextResponse.json(
        { error: 'A IA não retornou JSON válido. Tente novamente ou use um modelo diferente em Configurações → IA.' },
        { status: 500 }
      )
    }

    const slug = generateSlug(articleData.title)
    const cleanContent = sanitizeHtml(articleData.content, sanitizeOptions)
    const now = new Date()

    const [post] = await db
      .insert(posts)
      .values({
        title: articleData.title,
        slug,
        content: cleanContent,
        excerpt: articleData.excerpt ?? '',
        status: 'draft',
        updated_at: now,
      })
      .returning()

    return NextResponse.json({
      post_id: post.id,
      title: articleData.title,
      excerpt: articleData.excerpt ?? '',
      content: cleanContent,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
