import Link from 'next/link'
import { SearchBar } from '@/components/blog/SearchBar'
import { getAllCategories } from '@/lib/db-queries'

type Props = {
  blogName: string
  logoUrl?: string
}

/** Quantas categorias aparecem na navegação. Acima disso a barra fica poluída. */
const MAX_NAV_CATEGORIES = 5

/** Ícone Feather padrão do projeto: outline, 17x17, traço 1.75. */
const iconProps = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const linkFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary'

export async function Header({ blogName, logoUrl }: Props) {
  const categories = (await getAllCategories()).slice(0, MAX_NAV_CATEGORIES)

  return (
    <header className="relative bg-brand-primary text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Marca */}
        <Link
          href="/"
          className={`flex items-center gap-3 shrink-0 rounded-md transition-opacity hover:opacity-90 ${linkFocus}`}
        >
          {/* alt vazio de propósito: o nome do blog já aparece ao lado */}
          {logoUrl && <img src={logoUrl} alt="" className="h-9 w-auto" />}
          <span className="font-display text-xl font-semibold tracking-tight">{blogName}</span>
        </Link>

        {/* Navegação desktop */}
        <nav aria-label="Menu principal" className="hidden md:flex items-center gap-5 text-sm">
          <Link
            href="/"
            className={`border-b-2 border-transparent py-1 font-medium transition-colors hover:border-brand-secondary hover:text-brand-secondary ${linkFocus}`}
          >
            Início
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categoria/${category.slug}`}
              className={`border-b-2 border-transparent py-1 font-medium text-white/85 transition-colors hover:border-brand-secondary hover:text-brand-secondary ${linkFocus}`}
            >
              {category.name}
            </Link>
          ))}
        </nav>

        {/* Busca desktop */}
        <div className="hidden md:block w-full max-w-[220px]">
          <SearchBar />
        </div>

        {/*
          Menu do celular sem JavaScript: <details> nativo.
          O Header é Server Component (busca categorias no banco), então nada de useState aqui.
        */}
        <details className="group md:hidden">
          <summary
            aria-label="Abrir menu de navegação"
            className={`flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-white/25 transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden ${linkFocus}`}
          >
            <svg {...iconProps} className="group-open:hidden">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <svg {...iconProps} className="hidden group-open:block">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </summary>

          <div className="absolute inset-x-0 top-full z-40 border-t border-white/10 bg-brand-primary shadow-lg">
            <div className="max-w-6xl mx-auto px-4 py-4">
              <SearchBar />
              <nav aria-label="Menu do celular" className="mt-4 flex flex-col">
                <Link
                  href="/"
                  className={`border-l-2 border-transparent py-2.5 pl-3 text-base font-medium transition-colors hover:border-brand-secondary hover:bg-white/5 ${linkFocus}`}
                >
                  Início
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categoria/${category.slug}`}
                    className={`border-l-2 border-transparent py-2.5 pl-3 text-base font-medium text-white/85 transition-colors hover:border-brand-secondary hover:bg-white/5 ${linkFocus}`}
                  >
                    {category.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </details>
      </div>

      {/* Linha de acento da marca */}
      <div className="h-[3px] bg-brand-secondary" aria-hidden="true" />
    </header>
  )
}
