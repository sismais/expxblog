import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PostGrid } from '@/components/blog/PostGrid'
import { Pagination } from '@/components/ui/Pagination'
import { getPostsPage, getTagBySlug } from '@/lib/db-queries'
import { getAppUrl } from '@/lib/app-url'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tag = await getTagBySlug(params.slug)
  if (!tag) {
    return { title: 'Tag não encontrada', robots: { index: false, follow: false } }
  }

  const url = `${getAppUrl()}/tag/${tag.slug}`
  const description = `Artigos marcados com ${tag.name}.`

  return {
    title: tag.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: tag.name, description, url, type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary', title: tag.name, description },
  }
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { page?: string }
}) {
  const [postsData, tag] = await Promise.all([
    getPostsPage({ page: searchParams.page, limit: '9', tag: params.slug }),
    getTagBySlug(params.slug),
  ])

  if (!tag) notFound()

  return (
    <div>
      <Link href="/" className="text-brand-primary text-sm hover:underline mb-4 inline-block">← Blog</Link>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary mb-1">Assunto</p>
      <h1 className="font-display text-3xl font-bold text-neutral-900 mb-6">{tag.name}</h1>
      <PostGrid posts={postsData.posts} />
      <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
    </div>
  )
}
