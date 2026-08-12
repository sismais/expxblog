import Link from 'next/link'

export type BreadcrumbItem = {
  name: string
  /** Sem href = item atual (último da trilha) */
  href?: string
}

/**
 * Trilha de navegação do topo do artigo (Início › Categoria › Título).
 * Server Component — só marcação, sem estado.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Você está aqui" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-x-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-gray-300">
                  ›
                </span>
              )}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-brand-primary hover:underline">
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="max-w-[16rem] truncate text-gray-700 sm:max-w-none"
                >
                  {item.name}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
