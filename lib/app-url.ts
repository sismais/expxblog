function normalize(url: string): string {
  const withProtocol = /^https?:\/\//.test(url) ? url : `https://${url}`
  return withProtocol.replace(/\/+$/, '')
}

/**
 * URL pública do blog, usada em canonical, sitemap, robots e feed.
 *
 * A ordem importa: VERCEL_URL é a URL do deployment (muda a cada deploy) e só
 * serve como último recurso — usá-la em canonical faz o Google ver um endereço
 * instável. VERCEL_PROJECT_PRODUCTION_URL é estável entre deploys.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return normalize(process.env.NEXT_PUBLIC_APP_URL)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (process.env.VERCEL_URL) return normalize(process.env.VERCEL_URL)
  return 'http://localhost:3000'
}
