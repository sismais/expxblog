import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PostGrid } from '@/components/blog/PostGrid'
import { Pagination } from '@/components/ui/Pagination'
import { getPostsPage, getCategoryBySlug } from '@/lib/db-queries'
import { getAppUrl } from '@/lib/app-url'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug)
  if (!category) {
    return { title: 'Categoria não encontrada', robots: { index: false, follow: false } }
  }

  const url = `${getAppUrl()}/categoria/${category.slug}`
  const description =
    category.description || `Todos os artigos sobre ${category.name}.`

  return {
    title: category.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: category.name, description, url, type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary', title: category.name, description },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { page?: string }
}) {
  const [postsData, category] = await Promise.all([
    getPostsPage({ page: searchParams.page, limit: '9', category: params.slug }),
    getCategoryBySlug(params.slug),
  ])

  if (!category) notFound()

  return (
    <div>
      <Link href="/" className="text-brand-primary text-sm hover:underline mb-4 inline-block">← Blog</Link>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary mb-1">Categoria</p>
      <h1 className="font-display text-3xl font-bold text-neutral-900 mb-2">{category.name}</h1>
      {category.description && <p className="text-gray-500 mb-6">{category.description}</p>}
      <PostGrid posts={postsData.posts} />
      <Pagination currentPage={postsData.page} totalPages={postsData.pages} />
    </div>
  )
}
