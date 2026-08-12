'use client'

import { useEffect, useState } from 'react'

type Props = {
  /** URL absoluta do artigo */
  url: string
  title: string
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

/** Fallback pra navegador sem clipboard API (ou página servida sem HTTPS) */
function copyWithTextarea(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

const baseButton =
  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2'

export function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timeout)
  }, [copied])

  async function handleCopy() {
    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) ok = copyWithTextarea(url)
    if (ok) setCopied(true)
  }

  const encodedUrl = encodeURIComponent(url)
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-gray-600">Compartilhar:</span>

      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no WhatsApp"
        className={`${baseButton} border-brand-primary bg-brand-primary text-white hover:bg-brand-primary-dark`}
      >
        <svg {...iconProps}>
          <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-4-1L4 20l1.2-4.4a8.3 8.3 0 0 1-1.1-4.1A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
          <path d="M9.2 8.4c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.2-.2.3 0 .6.3.5.7 1 1.2 1.4.5.4.9.6 1.1.7.2.1.4 0 .5-.1l.5-.5c.2-.2.3-.2.5-.1l1.4.7c.2.1.4.2.4.4 0 .2 0 .8-.3 1.1-.3.4-.9.7-1.4.7-.6 0-1.6-.2-3.1-1.1a9 9 0 0 1-3.2-3.4c-.4-.8-.5-1.5-.5-2 0-.5.3-1 .6-1.2Z" />
        </svg>
        WhatsApp
      </a>

      <a
        href={facebook}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no Facebook"
        className={`${baseButton} border-gray-300 text-neutral-900 hover:border-brand-primary hover:text-brand-primary`}
      >
        <svg {...iconProps}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />
        </svg>
        Facebook
      </a>

      <a
        href={linkedin}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Compartilhar no LinkedIn"
        className={`${baseButton} border-gray-300 text-neutral-900 hover:border-brand-primary hover:text-brand-primary`}
      >
        <svg {...iconProps}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
        LinkedIn
      </a>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copiar link do artigo"
        className={`${baseButton} border-gray-300 text-neutral-900 hover:border-brand-primary hover:text-brand-primary`}
      >
        {copied ? (
          <svg {...iconProps}>
            <path d="m20 6-11 11-5-5" />
          </svg>
        ) : (
          <svg {...iconProps}>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {copied ? 'Link copiado' : 'Copiar link'}
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? 'Link copiado para a área de transferência' : ''}
      </span>
    </div>
  )
}
