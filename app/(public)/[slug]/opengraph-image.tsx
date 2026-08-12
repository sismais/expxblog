import { ImageResponse } from 'next/og'
import { and, eq } from 'drizzle-orm'
import { db } from '@/drizzle/db'
import { posts } from '@/drizzle/schema'
import { getSettings } from '@/lib/settings'

/**
 * Imagem de compartilhamento (Open Graph) gerada na hora, usada quando o
 * artigo não tem imagem de capa.
 *
 * O ImageResponse (satori) não enxerga Tailwind nem CSS var — por isso as
 * cores da marca entram como hex literal aqui. É a única exceção do projeto.
 * Também não carregamos fonte pela rede de propósito: a identidade vem da
 * cor e da composição, e um fetch no Google Fonts deixaria a geração lenta.
 */

export const runtime = 'nodejs'

// O blog inteiro é dinâmico (a layout pública é force-dynamic) e aqui lemos o
// banco, então nada de tentar pré-renderizar isso no build.
export const dynamic = 'force-dynamic'

export const alt = 'Imagem de compartilhamento do artigo'

export const size = { width: 1200, height: 630 }

export const contentType = 'image/png'

/** Navy Sismais — fundo */
const NAVY = '#10293F'
/** Cyan Sismais — faixa, ponto e acentos */
const CYAN = '#45E5E5'

/**
 * Corta o título por contagem de caracteres. O `line-clamp` não é confiável
 * no satori, então limitamos no texto mesmo para não passar de ~3 linhas.
 */
const TITLE_MAX_CHARS = 108

function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.trimEnd()}…`
}

async function getPostTitle(slug: string): Promise<string | null> {
  try {
    const [post] = await db
      .select({ title: posts.title })
      .from(posts)
      .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
      .limit(1)

    return post?.title ?? null
  } catch {
    // Banco fora do ar ou sem DATABASE_URL: geramos a imagem só com a marca.
    return null
  }
}

async function getBlogName(): Promise<string> {
  const { company } = await getSettings()
  return company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
}

export default async function Image({ params }: { params: { slug: string } }) {
  const [title, blogName] = await Promise.all([getPostTitle(params.slug), getBlogName()])

  // Sem post (slug inexistente ou banco fora do ar) vira um card só da marca:
  // o nome do blog no lugar do título e sem rodapé, para não repetir o nome duas vezes.
  const heading = title ? clampText(title, TITLE_MAX_CHARS) : blogName
  // Título curto respira melhor grande; título longo precisa encolher para caber em 3 linhas.
  const headingSize = heading.length > 72 ? 58 : heading.length > 42 ? 68 : 78

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: NAVY,
        }}
      >
        {/* Faixa cyan no topo */}
        <div style={{ display: 'flex', width: '100%', height: 14, backgroundColor: CYAN }} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: 60,
          }}
        >
          {/* Bloco do título — centralizado no espaço que sobra, para o card
              ficar equilibrado tanto com título curto quanto com título longo */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 72,
                height: 8,
                backgroundColor: CYAN,
                marginBottom: 34,
              }}
            />
            <div
              style={{
                display: 'flex',
                color: '#FFFFFF',
                fontSize: headingSize,
                fontWeight: 700,
                lineHeight: 1.16,
                letterSpacing: -1,
                maxWidth: 1020,
              }}
            >
              {heading}
            </div>
          </div>

          {/* Rodapé com o nome do blog. Só aparece quando há título de post —
              sem post o nome já é o destaque, e repetir ficaria estranho. */}
          {title ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  marginBottom: 28,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: CYAN,
                    marginRight: 16,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    color: '#FFFFFF',
                    fontSize: 30,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                  }}
                >
                  {blogName}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    size
  )
}
