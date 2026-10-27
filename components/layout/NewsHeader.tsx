import Link from 'next/link'
import { SearchBar } from '@/components/blog/SearchBar'
import { db } from '@/drizzle/db'
import { categories, posts, postCategories } from '@/drizzle/schema'
import { asc, eq, and } from 'drizzle-orm'

async function getCategories() {
  try {
    return db.selectDistinct({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
    })
    .from(categories)
    .innerJoin(postCategories, eq(postCategories.category_id, categories.id))
    .innerJoin(posts, eq(posts.id, postCategories.post_id))
    .where(eq(posts.status, 'published'))
    .orderBy(asc(categories.name))
  } catch {
    return []
  }
}

interface Props {
  blogName: string
  logoUrl?: string
}

export async function NewsHeader({ blogName, logoUrl }: Props) {
  const cats = await getCategories()

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* Row 1: white — logo + search */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
            {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto" />}
            <span
              className="text-lg font-bold tracking-tight whitespace-nowrap"
              style={{ color: 'var(--color-primary)' }}
            >
              {blogName}
            </span>
          </Link>
          <div className="w-full max-w-sm">
            <SearchBar variant="light" />
          </div>
        </div>
      </div>

      {/* Row 2: primary color — category nav */}
      <div style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            <Link
              href="/"
              className="px-4 py-2 text-sm font-bold text-white whitespace-nowrap hover:bg-white/10 transition-colors border-b-2 border-transparent hover:border-white/50"
            >
              Início
            </Link>
            {cats.map((cat) => (
              <Link
                key={cat.id}
                href={`/categoria/${cat.slug}`}
                className="px-4 py-2 text-sm font-medium text-white/80 whitespace-nowrap hover:text-white hover:bg-white/10 transition-colors border-b-2 border-transparent hover:border-white/50"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
