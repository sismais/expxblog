import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/app-url'
import { getSitemapData } from '@/lib/db-queries'

// Lê do banco em runtime — sem isso o Next tenta gerar no build, quando
// DATABASE_URL pode nem existir ainda (wizard de instalação).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppUrl()
  // getSitemapData() engole erro de banco e devolve listas vazias:
  // banco fora do ar vira sitemap só com a home, nunca 500.
  const { posts, categories, tags } = await getSitemapData()

  const home: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/${post.slug}`,
    lastModified: post.updated_at ?? post.published_at ?? new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${baseUrl}/categoria/${category.slug}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const tagEntries: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${baseUrl}/tag/${tag.slug}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...home, ...postEntries, ...categoryEntries, ...tagEntries]
}
