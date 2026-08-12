type Props = {
  /** Data de publicação; quando nula, a linha de data não aparece */
  publishedAt: Date | null
  /** Já formatado por readingTimeLabel() — ex.: "4 min de leitura" */
  readingTime: string
  /** Nome da empresa/blog. O schema de posts não tem autor por pessoa. */
  author: string
}

const iconProps = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Linha de contexto do artigo: quem publicou, quando e quanto tempo leva pra ler.
 * Server Component.
 */
export function ArticleMeta({ publishedAt, readingTime, author }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
      {author && (
        <span className="inline-flex items-center gap-1.5">
          <svg {...iconProps}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="font-medium text-neutral-900">{author}</span>
        </span>
      )}

      {publishedAt && (
        <span className="inline-flex items-center gap-1.5">
          <svg {...iconProps}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <time dateTime={publishedAt.toISOString()}>{formatDate(publishedAt)}</time>
        </span>
      )}

      <span className="inline-flex items-center gap-1.5">
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>{readingTime}</span>
      </span>
    </div>
  )
}
