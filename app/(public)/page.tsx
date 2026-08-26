import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PostGrid } from '@/components/blog/PostGrid'
import { CategoryFilter } from '@/components/blog/CategoryFilter'
import { HeroPost } from '@/components/blog/HeroPost'
import { EditorialGrid } from '@/components/blog/EditorialGrid'
import { Pagination } from '@/components/ui/Pagination'
import { getSettings } from '@/lib/settings'
import { getAppUrl } from '@/lib/app-url'
import { getPostsPage, getAllCategories } from '@/lib/db-queries'
import { PostCardFeatured } from '@/components/blog/PostCardFeatured'
import { FeaturedSection } from '@/components/blog/FeaturedSection'
import { PostCardBusiness } from '@/components/blog/PostCardBusiness'
import { CategorySection } from '@/components/blog/CategorySection'
import { NewsSidebar } from '@/components/blog/NewsSidebar'
import { TechHero } from '@/components/blog/TechHero'
import { PostCardTech } from '@/components/blog/PostCardTech'
import { PostCardNews } from '@/components/blog/PostCardNews'
import { db } from '@/drizzle/db'
import { posts, postCategories, categories, tags } from '@/drizzle/schema'
import { eq, desc, and, asc } from 'drizzle-orm'

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSettings()
  const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
  const description = company.blog_description || ''
  const url = getAppUrl()

  return {
    // `absolute` evita virar "Home | Nome do Blog" na página inicial.
    title: { absolute: blogName },
    description,
    alternates: { canonical: url },
    openGraph: {
      title: blogName,
      description,
      url,
      siteName: blogName,
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: { card: 'summary_large_image', title: blogName, description },
  }
}


type NewsPost = {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string
  cover_image: string | null
  published_at: string | null
  categories: { id: number; name: string; slug: string }[]
}

async function getTechHeroPosts(): Promise<NewsPost[]> {
  try {
    const rows = await db
      .select({ post: posts })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.published_at))
      .limit(3)

    return Promise.all(
      rows.map(async ({ post: p }) => {
        const catRows = await db
          .select({ category: categories })
          .from(postCategories)
          .innerJoin(categories, eq(categories.id, postCategories.category_id))
          .where(eq(postCategories.post_id, p.id))
          .limit(3)
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string; category?: string; tag?: string }
}) {
  const { template, company } = await getSettings()

  const pageLimit =
    template === 'portal' ? '13' :
    template === 'business' ? '12' :
    template === 'news' ? '10' :
    template === 'tech' ? '10' :
    '9'
  const [postsData, categoriesData] = await Promise.all([
    getPostsPage({ page: searchParams.page, limit: pageLimit, category: searchParams.category, tag: searchParams.tag }),
    getAllCategories().then((cats) => ({ categories: cats })),
  ])

  if (template === 'portal') {
    const [heroPost, ...gridPosts] = postsData.posts
    return (
      <div>
        {heroPost && <HeroPost post={heroPost} />}
        <EditorialGrid posts={gridPosts} />
        <Suspense>
          <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
        </Suspense>
      </div>
    )
  }

  if (template === 'news') {
    const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
    const postsWithDates = postsData.posts.map((p) => ({
      ...p,
      published_at: p.published_at?.toISOString() ?? null,
    }))

    const [leadPost, ...listPosts] = postsWithDates
    const showLead = Boolean(leadPost)

    return (
      <div>
        <div className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
            {blogName}
          </h1>
          {company.blog_description && (
            <p className="text-gray-600 leading-relaxed">{company.blog_description}</p>
          )}
        </div>

        <div className="flex gap-8">
          <div className="flex-1 min-w-0">
            {postsWithDates.length === 0 && (
              <p className="text-gray-500">Nenhum post publicado ainda.</p>
            )}

            {showLead && (
              <div className="mb-8">
                <PostCardNews post={leadPost} variant="lead" />
              </div>
            )}

            {listPosts.length > 0 && (
              <div className="space-y-6">
                {listPosts.map((post) => (
                  <div key={post.id} className="border-b border-gray-100 pb-6 last:border-0">
                    <PostCardNews post={post} variant="horizontal" />
                  </div>
                ))}
              </div>
            )}

            <Suspense>
              <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
            </Suspense>
          </div>

          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24">
              <NewsSidebar />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (template === 'business') {
    const [p1, p2, p3, p4, ...rest] = postsData.posts
    const featuredPosts = [p1, p2, p3, p4].filter(Boolean)
    return (
      <div>
        <FeaturedSection posts={featuredPosts} />
        {rest.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-bold text-neutral-900 whitespace-nowrap">Artigos Recentes</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((post: { id: number; title: string; slug: string; content: string; excerpt: string; cover_image: string | null; published_at: Date | null; categories: { id: number; name: string; slug: string }[] }) => (
                <PostCardBusiness key={post.id} post={post} variant="grid" />
              ))}
            </div>
          </div>
        )}
        <Suspense>
          <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
        </Suspense>
      </div>
    )
  }

  if (template === 'tech') {
    const heroPosts = await getTechHeroPosts()
    const listPosts = postsData.posts.map((p) => ({
      ...p,
      published_at: p.published_at?.toISOString() ?? null,
    }))
    return (
      <div>
        <TechHero posts={heroPosts} />
        {listPosts.length === 0 && (
          <p className="text-gray-500 mt-8">Nenhum post publicado ainda.</p>
        )}
        {listPosts.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-1 h-6 rounded-full"
                style={{ backgroundColor: 'var(--color-secondary)' }}
              />
              <h2 className="text-base font-bold text-neutral-900 uppercase tracking-widest">
                Últimos artigos
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {listPosts.map((post) => (
                <PostCardTech key={post.id} post={post} variant="highlight" />
              ))}
            </div>
            <Suspense>
              <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
            </Suspense>
          </div>
        )}
      </div>
    )
  }

  // O destaque só aparece na primeira página sem filtro: dentro de um filtro ou
  // na página 2 em diante, promover um artigo confunde mais do que ajuda.
  const isUnfilteredFirstPage =
    postsData.page === 1 && !searchParams.category && !searchParams.tag
  const [featuredPost, ...restPosts] = postsData.posts
  const showFeatured = isUnfilteredFirstPage && Boolean(featuredPost)
  const gridPosts = showFeatured ? restPosts : postsData.posts

  const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'

  return (
    <div>
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-neutral-900 mb-2">
          {blogName}
        </h1>
        {company.blog_description && (
          <p className="text-gray-600 leading-relaxed">{company.blog_description}</p>
        )}
      </div>

      <Suspense>
        <CategoryFilter
          categories={categoriesData.categories}
          selected={searchParams.category}
        />
      </Suspense>

      {showFeatured && (
        <div className="mt-6">
          <PostCardFeatured post={featuredPost} />
        </div>
      )}

      {gridPosts.length > 0 && (
        <div className="mt-8">
          {showFeatured && (
            <div className="flex items-center gap-3 mb-6">
              <h2 className="font-display text-lg font-bold text-neutral-900 whitespace-nowrap">
                Mais artigos
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}
          <PostGrid posts={gridPosts} />
        </div>
      )}

      {!showFeatured && gridPosts.length === 0 && (
        <div className="mt-6">
          <PostGrid posts={gridPosts} />
        </div>
      )}

      <Suspense>
        <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
      </Suspense>
    </div>
  )
}
