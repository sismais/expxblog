import { NextRequest, NextResponse } from 'next/server'
import { aiChat } from '@/lib/ai'
import { db } from '@/drizzle/db'
import { posts, postCategories, siteSettings } from '@/drizzle/schema'
import { generateSlug } from '@/lib/slug'
import sanitizeHtml from 'sanitize-html'
import { sanitizeOptions } from '@/lib/sanitize'
import { eq } from 'drizzle-orm'
import { getArticleConfig, buildArticleConfigPromptSection } from '@/lib/article-config'


export async function POST(request: NextRequest) {
  try {
    const { title, description, category_id } = await request.json()
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })
    }

    let briefingContent = ''
    try {
      const rows = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, 'briefing_content'))
        .limit(1)
      briefingContent = rows.length > 0 ? rows[0].value ?? '' : ''
    } catch {}

    let contextSection = ''
    if (briefingContent) {
      contextSection = `
CONTEXTO DA EMPRESA (briefing):
---
${briefingContent.slice(0, 8000)}
---

Use o contexto acima para garantir que o artigo seja relevante para o negócio, produtos e público-alvo da empresa.`
    }

    const articleConfig = await getArticleConfig()
    const configSection = buildArticleConfigPromptSection(articleConfig)

    const prompt = `Você é um redator profissional especializado em blogs corporativos. Escreva um artigo completo e detalhado sobre:

Título: ${title}
${description ? `Descrição/Resumo: ${description}` : ''}
${contextSection}

${configSection}

Requisitos técnicos:
- O artigo deve ter pelo menos ${articleConfig.minWords} palavras
- Use formatação HTML para estruturar o conteúdo (h2, h3, p, strong, em, ul, ol, li, blockquote)
- Inclua uma introdução envolvente
- Desenvolva o conteúdo com subtítulos bem estruturados
- Termine com uma conclusão
- O conteúdo deve ser informativo, bem escrito e otimizado para SEO

Responda com um JSON válido (sem markdown, sem \`\`\`) com a seguinte estrutura:
{
  "title": "título do artigo (pode ser melhorado)",
  "excerpt": "resumo do artigo em até 160 caracteres",
  "content": "conteúdo HTML completo do artigo"
}`

    const result = await aiChat(
      'content_generation',
      [
        {
          role: 'system',
          content:
            'Você é um redator profissional especializado em criação de conteúdo para blogs corporativos. Sempre responda em JSON válido, sem markdown.',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: articleConfig.creativity, max_tokens: 8000 }
    )

    let articleData: { title: string; excerpt: string; content: string }
    try {
      const cleaned = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      articleData = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[generate] JSON parse failed:', parseErr)
      console.error('[generate] AI raw response (first 500):', result?.slice(0, 500))
      return NextResponse.json(
        { error: 'A IA não retornou JSON válido. Tente novamente ou use um modelo diferente em Configurações → IA.' },
        { status: 500 }
      )
    }

    const slug = generateSlug(articleData.title) + '-' + Date.now()
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

    if (category_id && post) {
      await db.insert(postCategories).values({ post_id: post.id, category_id })
    }

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
