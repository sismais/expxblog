import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/Badge'
import { Breadcrumb } from '@/components/blog/Breadcrumb'
import type { BreadcrumbItem } from '@/components/blog/Breadcrumb'
import { ArticleMeta } from '@/components/blog/ArticleMeta'
import { ShareButtons } from '@/components/blog/ShareButtons'
import { RelatedPosts } from '@/components/blog/RelatedPosts'
import { getAppUrl } from '@/lib/app-url'
import { getSettings } from '@/lib/settings'
import { readingTimeLabel } from '@/lib/reading-time'
import { blogPostingJsonLd, breadcrumbJsonLd, jsonLdScript } from '@/lib/structured-data'
import { db } from '@/drizzle/db'
import { posts, categories, tags, postCategories, postTags } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'

/**
 * `cache` evita rodar as três queries duas vezes (generateMetadata + página)
 * dentro da mesma requisição.
 */
const getPost = cache(async (slug: string) => {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
    .limit(1)

  if (!post) return null

  const postCats = await db
    .select({ category: categories })
    .from(postCategories)
    .innerJoin(categories, eq(postCategories.category_id, categories.id))
    .where(eq(postCategories.post_id, post.id))

  const postTagsList = await db
    .select({ tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tag_id, tags.id))
    .where(eq(postTags.post_id, post.id))

  return {
    ...post,
    categories: postCats.map((r) => r.category),
    tags: postTagsList.map((r) => r.tag),
  }
})

/** Texto puro do HTML — usado no wordCount do JSON-LD */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Só os hosts liberados em next.config.js podem passar pelo otimizador do next/image */
const OPTIMIZABLE_HOSTS = [
  /^i\.imgur\.com$/,
  /(^|\.)cloudinary\.com$/,
  /^images\.unsplash\.com$/,
  /(^|\.)supabase\.co$/,
]

function isOptimizableImage(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url)
    if (protocol !== 'https:') return false
    return OPTIMIZABLE_HOSTS.some((pattern) => pattern.test(hostname))
  } catch {
    return false
  }
}

/** Monta o link de WhatsApp a partir do telefone cadastrado em site_settings */
function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const withCountry = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug)
  const baseUrl = getAppUrl()

  if (!post) {
    return {
      title: 'Artigo não encontrado',
      robots: { index: false, follow: false },
    }
  }

  const { company } = await getSettings()
  const siteName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
  const url = `${baseUrl}/${post.slug}`
  // A chave `images` precisa ficar AUSENTE do objeto quando o post não tem capa.
  // Declará-la, mesmo como undefined, faz o Next entender que a imagem foi
  // definida à mão e não injetar a capa gerada pelo opengraph-image.tsx.
  const ogImages = post.cover_image
    ? { images: [{ url: post.cover_image, alt: post.title }] }
    : {}
  const twitterImages = post.cover_image ? { images: [post.cover_image] } : {}

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url,
      siteName,
      locale: 'pt_BR',
      ...ogImages,
      publishedTime: post.published_at?.toISOString(),
      modifiedTime: post.updated_at?.toISOString(),
      ...(post.tags.length > 0 ? { tags: post.tags.map((t) => t.name) } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      ...twitterImages,
    },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  if (!post) notFound()

  const { company } = await getSettings()
  const baseUrl = getAppUrl()
  const url = `${baseUrl}/${post.slug}`
  const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
  const author = company.company_name || blogName
  const mainCategory = post.categories[0] ?? null

  const trail: BreadcrumbItem[] = [
    { name: 'Início', href: '/' },
    ...(mainCategory ? [{ name: mainCategory.name, href: `/categoria/${mainCategory.slug}` }] : []),
    { name: post.title },
  ]

  const articleJsonLd = blogPostingJsonLd({
    baseUrl,
    blogName,
    company,
    post: {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      cover_image: post.cover_image,
      published_at: post.published_at,
      updated_at: post.updated_at,
    },
    categories: post.categories,
    tags: post.tags,
    wordCount: plainText(post.content).split(' ').filter(Boolean).length,
  })

  const crumbsJsonLd = breadcrumbJsonLd({
    baseUrl,
    trail: [
      { name: 'Início', path: '/' },
      ...(mainCategory ? [{ name: mainCategory.name, path: `/categoria/${mainCategory.slug}` }] : []),
      { name: post.title, path: `/${post.slug}` },
    ],
  })

  const ctaMessage = `Oi! Vi o artigo "${post.title}" no blog e quero saber mais sobre o sistema.`
  const ctaWhatsapp = company.company_phone ? whatsappLink(company.company_phone, ctaMessage) : null
  const ctaHref = ctaWhatsapp ?? (company.company_email ? `mailto:${company.company_email}` : '/')
  const ctaLabel = ctaWhatsapp
    ? 'Falar no WhatsApp'
    : company.company_email
      ? 'Mandar um e-mail'
      : 'Ver mais artigos'
  const ctaExternal = ctaHref.startsWith('http')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(crumbsJsonLd) }}
      />

      <div className="mx-auto max-w-3xl">
        <Breadcrumb items={trail} />
      </div>

      <article className="mx-auto max-w-3xl">
        <header>
          {post.categories.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {post.categories.map((cat) => (
                <Link key={cat.id} href={`/categoria/${cat.slug}`}>
                  <Badge variant="category">{cat.name}</Badge>
                </Link>
              ))}
            </div>
          )}

          <h1 className="font-display text-3xl font-bold leading-tight text-neutral-900 md:text-4xl">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-4 font-serif text-lg leading-relaxed text-gray-600">{post.excerpt}</p>
          )}

          <div className="mt-6 border-t border-gray-200 pt-5">
            <ArticleMeta
              publishedAt={post.published_at}
              readingTime={readingTimeLabel(post.content)}
              author={author}
            />
          </div>
        </header>
      </article>

      {post.cover_image && (
        <div className="mx-auto my-8 max-w-4xl">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100">
            {isOptimizableImage(post.cover_image) ? (
              <Image
                src={post.cover_image}
                alt={post.title}
                fill
                priority
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-cover"
              />
            ) : (
              // Host fora do next.config.js — <img> direto, sem otimização
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.cover_image}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        <div
          className="prose prose-lg max-w-none font-serif text-neutral-900"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Assuntos:</span>
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/tag/${tag.slug}`}>
                <Badge variant="tag">{tag.name}</Badge>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6">
          <ShareButtons url={url} title={post.title} />
        </div>

        <aside className="mt-10 overflow-hidden rounded-xl bg-brand-primary">
          <div className="h-1 w-full bg-brand-secondary" aria-hidden="true" />
          <div className="p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
              Quer deixar a gestão da sua loja mais simples?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              Controle de estoque, vendas e caixa num lugar só. A gente mostra como funciona,
              sem enrolação e sem compromisso.
            </p>
            <a
              href={ctaHref}
              {...(ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-secondary px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary"
            >
              {ctaLabel}
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </aside>
      </div>

      <div className="mx-auto max-w-4xl">
        <RelatedPosts postId={post.id} categoryIds={post.categories.map((c) => c.id)} />
      </div>
    </>
  )
}
