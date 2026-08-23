import { PostCardNews } from '@/components/blog/PostCardNews'
import { db } from '@/drizzle/db'
import { posts, postCategories, categories } from '@/drizzle/schema'
import { eq, desc } from 'drizzle-orm'
import { getCategoriesWithCount, getMostViewedPosts } from '@/lib/db-queries'
import { getSettings } from '@/lib/settings'

async function getRecentPosts() {
  try {
    const recent = await db
      .select()
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.published_at))
      .limit(5)

    return Promise.all(
      recent.map(async (p) => {
        const catRows = await db
          .select({ category: categories })
          .from(postCategories)
          .innerJoin(categories, eq(categories.id, postCategories.category_id))
          .where(eq(postCategories.post_id, p.id))
          .limit(1)
        return {
          ...p,
          published_at: p.published_at?.toISOString() ?? null,
          categories: catRows.map((r) => r.category),
        }
      })
    )
  } catch {
    return []
  }
}

async function getMostViewedPostsWithFallback() {
  try {
    const mostViewed = await getMostViewedPosts(30, 5)

    if (mostViewed.length >= 5) {
      return Promise.all(
        mostViewed.map(async (p) => {
          const catRows = await db
            .select({ category: categories })
            .from(postCategories)
            .innerJoin(categories, eq(categories.id, postCategories.category_id))
            .where(eq(postCategories.post_id, p.id))
            .limit(1)
          return {
            ...p,
            published_at: p.published_at?.toISOString() ?? null,
            categories: catRows.map((r) => r.category),
          }
        })
      )
    }

    // Fallback: completar com posts recentes se não houver pageviews suficientes
    const recent = await db
      .select()
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.published_at))
      .limit(5)

    return Promise.all(
      recent.map(async (p) => {
        const catRows = await db
          .select({ category: categories })
          .from(postCategories)
          .innerJoin(categories, eq(categories.id, postCategories.category_id))
          .where(eq(postCategories.post_id, p.id))
          .limit(1)
        return {
          ...p,
          published_at: p.published_at?.toISOString() ?? null,
          categories: catRows.map((r) => r.category),
        }
      })
    )
  } catch {
    return []
  }
}

export async function NewsSidebar() {
  const [categories, recentPosts, mostViewedPosts, settings] = await Promise.all([
    getCategoriesWithCount(),
    getRecentPosts(),
    getMostViewedPostsWithFallback(),
    getSettings(),
  ])

  const downloadUrl = settings.company.download_url

  return (
    <aside className="space-y-8">
      {/* Categorias */}
      {categories.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2" style={{ borderColor: 'var(--color-secondary)' }}>
            <div
              className="h-4 w-[3px] rounded-sm"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            />
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
              Categorias
            </h2>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/categoria/${cat.slug}`}
                className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-neutral-100 transition-colors"
              >
                <span className="text-sm text-neutral-700">{cat.name}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600">
                  {cat.postCount}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Mais Vistos */}
      {mostViewedPosts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2" style={{ borderColor: 'var(--color-secondary)' }}>
            <div
              className="h-4 w-[3px] rounded-sm"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            />
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
              Mais Vistos
            </h2>
          </div>
          <div className="space-y-1">
            {mostViewedPosts.map((post, i) => (
              <PostCardNews key={post.id} post={post} variant="mini" rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Mais Recentes */}
      {recentPosts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2" style={{ borderColor: 'var(--color-secondary)' }}>
            <div
              className="h-4 w-[3px] rounded-sm"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            />
            <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-widest">
              Mais Recentes
            </h2>
          </div>
          <div className="space-y-1">
            {recentPosts.map((post) => (
              <PostCardNews key={post.id} post={post} variant="mini" />
            ))}
          </div>
        </div>
      )}

      {/* CTA Baixe o MaisSimples */}
      <div>
        <div
          className="rounded-lg p-6 text-center"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <h3 className="text-lg font-bold text-white mb-2">
            Primeira vez por aqui?
          </h3>
          <p className="text-sm text-white/90 mb-4">
            Baixe o Mais Simples e comece a organizar sua empresa hoje.
          </p>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2.5 rounded-md font-semibold text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--color-secondary)', color: '#1A1A2E' }}
          >
            Baixar o MaisSimples
          </a>
        </div>
      </div>

    </aside>
  )
}
