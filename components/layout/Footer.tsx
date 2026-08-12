import Link from 'next/link'
import { getAllCategories } from '@/lib/db-queries'

type Props = {
  blogName: string
  companyName: string
  companyEmail: string
  companyPhone: string
  socialFacebook: string
  socialInstagram: string
  socialTwitter: string
  socialYoutube: string
  /** Descrição do blog vinda do banco (site_settings). Sem fallback chumbado. */
  blogDescription?: string
  companyAddress?: string
  companyCnpj?: string
}

/** Quantas categorias aparecem na coluna de navegação. */
const MAX_FOOTER_CATEGORIES = 6

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

/** 00000000000000 -> 00.000.000/0000-00. Se não tiver 14 dígitos, devolve como veio. */
function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14) return value.trim()
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/** 77981210924 -> (77) 98121-0924. Fora do padrão brasileiro, devolve como veio. */
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return value.trim()
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-brand-secondary hover:text-brand-secondary ${linkFocus}`}
    >
      {children}
    </a>
  )
}

export async function Footer({
  blogName,
  companyName,
  companyEmail,
  companyPhone,
  socialFacebook,
  socialInstagram,
  socialTwitter,
  socialYoutube,
  blogDescription = '',
  companyAddress = '',
  companyCnpj = '',
}: Props) {
  const categories = (await getAllCategories()).slice(0, MAX_FOOTER_CATEGORIES)
  const hasSocial = Boolean(socialFacebook || socialInstagram || socialTwitter || socialYoutube)
  const hasContact = Boolean(companyEmail || companyPhone || companyAddress)
  const phoneHref = companyPhone.replace(/[^\d+]/g, '')

  return (
    <footer className="bg-brand-primary text-white mt-16">
      <div className="h-[3px] bg-brand-secondary" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Coluna 1 — marca */}
          <div>
            <p className="font-display text-xl font-semibold tracking-tight">{blogName}</p>
            {blogDescription && (
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{blogDescription}</p>
            )}
            {hasSocial && (
              <div className="mt-5 flex items-center gap-2.5">
                {socialFacebook && (
                  <SocialLink href={socialFacebook} label="Facebook">
                    <svg {...iconProps}>
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                    </svg>
                  </SocialLink>
                )}
                {socialInstagram && (
                  <SocialLink href={socialInstagram} label="Instagram">
                    <svg {...iconProps}>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </SocialLink>
                )}
                {socialTwitter && (
                  <SocialLink href={socialTwitter} label="Twitter">
                    <svg {...iconProps}>
                      <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
                    </svg>
                  </SocialLink>
                )}
                {socialYoutube && (
                  <SocialLink href={socialYoutube} label="YouTube">
                    <svg {...iconProps}>
                      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                      <path d="m9.75 15.02 5.75-3.27-5.75-3.27v6.54z" />
                    </svg>
                  </SocialLink>
                )}
              </div>
            )}
          </div>

          {/* Coluna 2 — navegação */}
          <nav aria-label="Links do rodapé">
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-brand-secondary">
              Navegar
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className={`text-white/70 transition-colors hover:text-white ${linkFocus}`}>
                  Início
                </Link>
              </li>
              <li>
                <Link href="/busca" className={`text-white/70 transition-colors hover:text-white ${linkFocus}`}>
                  Buscar artigos
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categoria/${category.slug}`}
                    className={`text-white/70 transition-colors hover:text-white ${linkFocus}`}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Coluna 3 — contato */}
          {hasContact && (
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-brand-secondary">
                Falar com a gente
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {companyEmail && (
                  <li>
                    <a
                      href={`mailto:${companyEmail}`}
                      className={`flex items-start gap-2.5 text-white/70 transition-colors hover:text-white ${linkFocus}`}
                    >
                      <span className="mt-0.5 shrink-0">
                        <svg {...iconProps}>
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </span>
                      <span className="break-all">{companyEmail}</span>
                    </a>
                  </li>
                )}
                {companyPhone && (
                  <li>
                    <a
                      href={`tel:${phoneHref}`}
                      className={`flex items-start gap-2.5 text-white/70 transition-colors hover:text-white ${linkFocus}`}
                    >
                      <span className="mt-0.5 shrink-0">
                        <svg {...iconProps}>
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </span>
                      <span>{formatPhone(companyPhone)}</span>
                    </a>
                  </li>
                )}
                {companyAddress && (
                  <li className="flex items-start gap-2.5 text-white/70">
                    <span className="mt-0.5 shrink-0">
                      <svg {...iconProps}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <span>{companyAddress}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-white/20 pt-5 text-center text-xs text-white/60">
          <p>
            © {new Date().getFullYear()} {companyName || blogName}. Todos os direitos reservados.
          </p>
          {companyCnpj && <p className="mt-1">CNPJ {formatCnpj(companyCnpj)}</p>}
        </div>
      </div>
    </footer>
  )
}
