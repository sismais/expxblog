import Link from 'next/link'
import {
  PostCategoryLabel,
  PostCover,
  PostMeta,
  type PostCardProps,
} from '@/components/blog/PostCard'

/**
 * Card grande de destaque: imagem 16:9 à esquerda, texto à direita.
 * Empilha no mobile. Mesmas props do PostCard.
 */
export function PostCardFeatured({ post }: PostCardProps) {
  const category = post.categories[0]

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:border-brand-secondary hover:shadow-xl focus-within:border-brand-secondary focus-within:shadow-xl md:grid md:grid-cols-2 md:items-stretch">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-primary-light md:h-full">
        <PostCover
          src={post.cover_image}
          title={post.title}
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>

      <div className="flex flex-col gap-3 p-6 md:justify-center lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-brand-secondary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-primary-dark">
            Destaque
          </span>
          {category && <PostCategoryLabel name={category.name} />}
        </div>

        <h2 className="font-display text-2xl font-bold leading-tight text-neutral-900 transition-colors group-hover:text-brand-primary lg:text-3xl">
          {/* Link cobre o card inteiro — área de clique grande, sem <a> aninhado */}
          <Link
            href={`/${post.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
          >
            <span className="line-clamp-3">{post.title}</span>
          </Link>
        </h2>

        {post.excerpt && (
          <p className="line-clamp-3 text-base leading-relaxed text-gray-600">{post.excerpt}</p>
        )}

        <PostMeta post={post} />

        <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-brand-primary">
          Ler artigo
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
            className="transition-transform duration-200 group-hover:translate-x-1"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </article>
  )
}
