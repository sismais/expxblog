import Link from 'next/link'
import { getRelatedPosts } from '@/lib/db-queries'

type Props = {
  postId: number
  categoryIds: number[]
  limit?: number
}

function formatDate(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/**
 * Bloco "continue lendo" no fim do artigo.
 * Marcação própria de propósito — não usa PostCard pra manter o item enxuto aqui.
 */
export async function RelatedPosts({ postId, categoryIds, limit = 3 }: Props) {
  const related = await getRelatedPosts({ postId, categoryIds, limit })
  if (related.length === 0) return null

  return (
    <section aria-labelledby="relacionados-titulo" className="mt-14 border-t border-gray-200 pt-10">
      <h2
        id="relacionados-titulo"
        className="mb-6 font-display text-xl font-semibold text-neutral-900"
      >
        Continue lendo
      </h2>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((post) => {
          const date = formatDate(post.published_at)
          return (
            <li key={post.id}>
              <Link href={`/${post.slug}`} className="group block">
                <div className="mb-3 aspect-[16/9] overflow-hidden rounded-lg bg-gray-100">
                  {post.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.cover_image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-brand-primary-light" aria-hidden="true" />
                  )}
                </div>

                <h3 className="font-display text-base font-semibold leading-snug text-neutral-900 group-hover:text-brand-primary">
                  {post.title}
                </h3>

                {date && post.published_at && (
                  <time
                    dateTime={post.published_at.toISOString()}
                    className="mt-1.5 block text-xs text-gray-500"
                  >
                    {date}
                  </time>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
