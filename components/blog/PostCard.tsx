import Image from 'next/image'
import Link from 'next/link'
import { readingTimeLabel } from '@/lib/reading-time'
import type { Category, Post } from '@/drizzle/schema'

/**
 * `content` é opcional porque nem toda query traz o corpo do artigo.
 * Sem ele, o card simplesmente não mostra o tempo de leitura.
 */
export type PostCardPost = Omit<Post, 'content'> & {
  content?: string | null
  categories: Category[]
}

export type PostCardProps = {
  post: PostCardPost
}

/**
 * Hosts liberados em `next.config.js`. Capa de outro host quebra o
 * next/image em runtime, então cai para <img> comum.
 */
const ALLOWED_IMAGE_HOSTS = ['i.imgur.com', 'images.unsplash.com']
const ALLOWED_IMAGE_HOST_SUFFIXES = ['.cloudinary.com', '.supabase.co']

export function isOptimizableImage(src: string): boolean {
  if (src.startsWith('/')) return true
  try {
    const { protocol, hostname } = new URL(src)
    if (protocol !== 'https:') return false
    const host = hostname.toLowerCase()
    return (
      ALLOWED_IMAGE_HOSTS.includes(host) ||
      ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
    )
  } catch {
    return false
  }
}

export function formatPostDate(date: Date | null): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function toIsoDate(date: Date | null): string | undefined {
  if (!date) return undefined
  return new Date(date).toISOString()
}

export type PostCoverProps = {
  src: string | null
  title: string
  sizes: string
  priority?: boolean
}

/** Capa do post: next/image quando o host é permitido, <img> quando não é. */
export function PostCover({ src, title, sizes, priority = false }: PostCoverProps) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-brand-primary-light">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-10 w-10 text-brand-primary opacity-40"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      </div>
    )
  }

  const alt = `Capa do artigo ${title}`
  const className =
    'object-cover transition-transform duration-300 group-hover:scale-105'

  if (isOptimizableImage(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  )
}

/** Categoria como acento pequeno: bolinha cyan + texto navy. */
export function PostCategoryLabel({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-primary">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-secondary" />
      {name}
    </span>
  )
}

/** Data + tempo de leitura, discretos. */
export function PostMeta({ post }: PostCardProps) {
  const date = formatPostDate(post.published_at)
  const reading = post.content ? readingTimeLabel(post.content) : ''

  if (!date && !reading) return null

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
      {date && <time dateTime={toIsoDate(post.published_at)}>{date}</time>}
      {date && reading && (
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gray-300" />
      )}
      {reading && <span>{reading}</span>}
    </p>
  )
}

export function PostCard({ post }: PostCardProps) {
  const category = post.categories[0]

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-secondary hover:shadow-lg focus-within:border-brand-secondary focus-within:shadow-lg">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-primary-light">
        <PostCover
          src={post.cover_image}
          title={post.title}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        {category && <PostCategoryLabel name={category.name} />}

        <h2 className="font-display text-lg font-semibold leading-snug text-neutral-900 transition-colors group-hover:text-brand-primary">
          {/* Link cobre o card inteiro — área de clique grande, sem <a> aninhado */}
          <Link
            href={`/${post.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
          >
            <span className="line-clamp-2">{post.title}</span>
          </Link>
        </h2>

        {post.excerpt && (
          <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">{post.excerpt}</p>
        )}

        <div className="mt-auto pt-3">
          <PostMeta post={post} />
        </div>
      </div>
    </article>
  )
}
