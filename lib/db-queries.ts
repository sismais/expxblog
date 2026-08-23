import { db } from '@/drizzle/db'
import { posts, postCategories, categories, tags, postTags, pageViews } from '@/drizzle/schema'
import { eq, and, asc, desc, count, inArray, notInArray, sql } from 'drizzle-orm'

export async function getPostsPage(params: {
  page?: string | number
  limit?: string | number
  category?: string
  tag?: string
  search?: string
}) {
  try {
    const page = Math.max(1, parseInt(String(params.page ?? '1')) || 1)
    const limitNum = parseInt(String(params.limit ?? '10')) || 10
    if (limitNum <= 0) return { posts: [], total: 0, page, pages: 1 }
    const limit = Math.min(50, limitNum)
    const offset = (page - 1) * limit

    const conditions = [eq(posts.status, 'published')]

    if (params.search) {
      conditions.push(
        sql`(${posts.title} ILIKE ${'%' + params.search + '%'} OR ${posts.content} ILIKE ${'%' + params.search + '%'})`
      )
    }

    let postIds: number[] | undefined

    if (params.category) {
      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, params.category))
        .limit(1)
      if (cat) {
        const rels = await db
          .select({ post_id: postCategories.post_id })
          .from(postCategories)
          .where(eq(postCategories.category_id, cat.id))
        postIds = rels.map((r) => r.post_id)
      } else {
        postIds = []
      }
    }

    if (params.tag) {
      const [t] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.slug, params.tag))
        .limit(1)
      if (t) {
        const tagRels = await db
          .select({ post_id: postTags.post_id })
          .from(postTags)
          .where(eq(postTags.tag_id, t.id))
        const tagPostIds = tagRels.map((r) => r.post_id)
        postIds = postIds ? postIds.filter((id) => tagPostIds.includes(id)) : tagPostIds
      } else {
        postIds = []
      }
    }

    if (postIds !== undefined) {
      if (postIds.length === 0) return { posts: [], total: 0, page, pages: 0 }
      conditions.push(inArray(posts.id, postIds))
    }

    const whereClause = and(...conditions)
    const [{ total }] = await db.select({ total: count() }).from(posts).where(whereClause)

    const postRows = await db
      .select()
      .from(posts)
      .where(whereClause)
      .orderBy(desc(posts.published_at))
      .limit(limit)
      .offset(offset)

    if (postRows.length === 0) {
      return { posts: [], total, page, pages: Math.ceil(total / limit) }
    }

    const ids = postRows.map((p) => p.id)

    const allPostCats = await db
      .select({ post_id: postCategories.post_id, category: categories })
      .from(postCategories)
      .innerJoin(categories, eq(postCategories.category_id, categories.id))
      .where(inArray(postCategories.post_id, ids))

    const allPostTags = await db
      .select({ post_id: postTags.post_id, tag: tags })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tag_id, tags.id))
      .where(inArray(postTags.post_id, ids))

    return {
      posts: postRows.map((post) => ({
        ...post,
        categories: allPostCats.filter((r) => r.post_id === post.id).map((r) => r.category),
        tags: allPostTags.filter((r) => r.post_id === post.id).map((r) => r.tag),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    }
  } catch {
    return { posts: [], total: 0, page: 1, pages: 1 }
  }
}

export async function getCategoryBySlug(slug: string) {
  try {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)
    return cat ?? null
  } catch {
    return null
  }
}

export async function getTagBySlug(slug: string) {
  try {
    const [tag] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1)
    return tag ?? null
  } catch {
    return null
  }
}

export async function getAllCategories() {
  try {
    return await db.select().from(categories).orderBy(asc(categories.name))
  } catch {
    return []
  }
}

export async function getCategoriesWithCount() {
  try {
    const result = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        postCount: count(postCategories.post_id),
      })
      .from(categories)
      .leftJoin(postCategories, eq(postCategories.category_id, categories.id))
      .leftJoin(posts, and(eq(posts.id, postCategories.post_id), eq(posts.status, 'published')))
      .groupBy(categories.id)
      .having(sql`count(${posts.id}) > 0`)
      .orderBy(desc(sql`count(${posts.id})`), asc(categories.name))

    return result.filter((c) => c.postCount > 0)
  } catch {
    return []
  }
}

export async function getMostViewedPosts(days = 30, limit = 5) {
  try {
    const viewCounts = await db
      .select({
        path: pageViews.path,
        viewCount: count(pageViews.id),
      })
      .from(pageViews)
      .where(sql`${pageViews.visited_at} >= NOW() - INTERVAL '${days} days'`)
      .groupBy(pageViews.path)
      .orderBy(desc(count(pageViews.id)))
      .limit(limit)

    const paths = viewCounts.map((v) => v.path)
    const slugs = paths
      .filter((p) => p.startsWith('/') && p !== '/' && !p.startsWith('/categoria') && !p.startsWith('/tag'))
      .map((p) => p.replace(/^\//, ''))

    if (slugs.length === 0) {
      return []
    }

    const postsResult = await db
      .select()
      .from(posts)
      .where(and(eq(posts.status, 'published'), inArray(posts.slug, slugs)))

    return postsResult.sort((a, b) => {
      const aIndex = slugs.indexOf(a.slug)
      const bIndex = slugs.indexOf(b.slug)
      return aIndex - bIndex
    })
  } catch {
    return []
  }
}

/**
 * Artigos relacionados: mesmos assuntos primeiro, completando com os mais
 * recentes quando não há relacionados suficientes.
 */
export async function getRelatedPosts(params: {
  postId: number
  categoryIds: number[]
  limit?: number
}) {
  const limit = params.limit ?? 3
  try {
    let related: typeof posts.$inferSelect[] = []

    if (params.categoryIds.length > 0) {
      const rels = await db
        .select({ post_id: postCategories.post_id })
        .from(postCategories)
        .where(inArray(postCategories.category_id, params.categoryIds))

      const candidateIds = Array.from(new Set(rels.map((r) => r.post_id))).filter(
        (id) => id !== params.postId
      )

      if (candidateIds.length > 0) {
        related = await db
          .select()
          .from(posts)
          .where(and(eq(posts.status, 'published'), inArray(posts.id, candidateIds)))
          .orderBy(desc(posts.published_at))
          .limit(limit)
      }
    }

    if (related.length < limit) {
      const excludeIds = [params.postId, ...related.map((p) => p.id)]
      const fillers = await db
        .select()
        .from(posts)
        .where(and(eq(posts.status, 'published'), notInArray(posts.id, excludeIds)))
        .orderBy(desc(posts.published_at))
        .limit(limit - related.length)
      related = [...related, ...fillers]
    }

    return related
  } catch {
    return []
  }
}

/**
 * Busca post por ID para preview — retorna em qualquer status (draft ou published)
 * com categorias e tags carregadas. Usado apenas em preview admin.
 */
export async function getPostByIdForPreview(postId: number) {
  try {
    const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1)
    if (!post) return null

    const [postCats, postTagsList] = await Promise.all([
      db
        .select({ category: categories })
        .from(postCategories)
        .innerJoin(categories, eq(postCategories.category_id, categories.id))
        .where(eq(postCategories.post_id, post.id)),
      db
        .select({ tag: tags })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tag_id, tags.id))
        .where(eq(postTags.post_id, post.id)),
    ])

    return {
      ...post,
      categories: postCats.map((r) => r.category),
      tags: postTagsList.map((r) => r.tag),
    }
  } catch {
    return null
  }
}

/** Slugs e datas para montar o sitemap. */
export async function getSitemapData() {
  try {
    const [postRows, categoryRows, tagRows] = await Promise.all([
      db
        .select({ slug: posts.slug, updated_at: posts.updated_at, published_at: posts.published_at })
        .from(posts)
        .where(eq(posts.status, 'published'))
        .orderBy(desc(posts.published_at)),
      db.select({ slug: categories.slug }).from(categories),
      db.select({ slug: tags.slug }).from(tags),
    ])
    return { posts: postRows, categories: categoryRows, tags: tagRows }
  } catch {
    return { posts: [], categories: [], tags: [] }
  }
}
