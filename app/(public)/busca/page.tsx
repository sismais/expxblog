import type { Metadata } from 'next'
import Link from 'next/link'
import { PostGrid } from '@/components/blog/PostGrid'
import { SearchBar } from '@/components/blog/SearchBar'
import { getPostsPage } from '@/lib/db-queries'

// Resultado de busca não entra em índice: gera URL infinita e conteúdo duplicado.
export const metadata: Metadata = {
  title: 'Busca',
  description: 'Procure um artigo pelo assunto.',
  robots: { index: false, follow: true },
}

export default async function BuscaPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? ''
  const postsData = q.trim()
    ? await getPostsPage({ search: q, limit: '20' })
    : { posts: [], total: 0, page: 1, pages: 1 }

  return (
    <div>
      <Link href="/" className="text-brand-primary text-sm hover:underline mb-4 inline-block">← Blog</Link>
      <h1 className="font-display text-3xl font-bold text-neutral-900 mb-2">Buscar artigo</h1>

      <div className="max-w-md mb-6">
        <SearchBar initialValue={q} />
      </div>

      {q && (
        <p className="text-gray-500 mb-6">
          {postsData.posts.length > 0
            ? `${postsData.posts.length} resultado(s) para "${q}"`
            : `Nenhum resultado para "${q}"`}
        </p>
      )}

      <PostGrid posts={postsData.posts} />
    </div>
  )
}
