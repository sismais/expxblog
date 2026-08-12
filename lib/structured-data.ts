import type { CompanyInfo } from '@/lib/settings'

/**
 * Geradores de JSON-LD (schema.org).
 *
 * Motores de busca e plataformas de IA leem esses blocos para entender que tipo
 * de conteúdo a página tem, quem publicou e onde ela fica na hierarquia do site.
 * Tudo aqui é dado que já existe no banco — nada é inventado.
 */

type JsonLd = Record<string, unknown>

function socialLinks(company: CompanyInfo): string[] {
  return [
    company.social_facebook,
    company.social_instagram,
    company.social_twitter,
    company.social_youtube,
  ].filter((url): url is string => Boolean(url && url.trim()))
}

export function organizationJsonLd(params: {
  baseUrl: string
  blogName: string
  company: CompanyInfo
}): JsonLd {
  const { baseUrl, blogName, company } = params
  const sameAs = socialLinks(company)

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: company.company_name || blogName,
    url: baseUrl,
    ...(company.logo_url ? { logo: company.logo_url } : {}),
    ...(company.company_email ? { email: company.company_email } : {}),
    ...(company.company_phone ? { telephone: company.company_phone } : {}),
    ...(company.company_address
      ? { address: { '@type': 'PostalAddress', streetAddress: company.company_address } }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }
}

export function webSiteJsonLd(params: {
  baseUrl: string
  blogName: string
  description: string
}): JsonLd {
  const { baseUrl, blogName, description } = params

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    name: blogName,
    url: baseUrl,
    ...(description ? { description } : {}),
    inLanguage: 'pt-BR',
    publisher: { '@id': `${baseUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/busca?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function blogPostingJsonLd(params: {
  baseUrl: string
  blogName: string
  company: CompanyInfo
  post: {
    title: string
    slug: string
    excerpt: string
    cover_image: string | null
    published_at: Date | null
    updated_at: Date | null
  }
  categories: { name: string }[]
  tags: { name: string }[]
  wordCount: number
}): JsonLd {
  const { baseUrl, blogName, company, post, categories, tags, wordCount } = params
  const url = `${baseUrl}/${post.slug}`
  const publisherName = company.company_name || blogName

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}/#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.cover_image ? { image: [post.cover_image] } : {}),
    ...(post.published_at ? { datePublished: post.published_at.toISOString() } : {}),
    ...(post.updated_at ? { dateModified: post.updated_at.toISOString() } : {}),
    author: { '@type': 'Organization', name: publisherName, url: baseUrl },
    publisher: { '@id': `${baseUrl}/#organization` },
    ...(categories.length > 0 ? { articleSection: categories.map((c) => c.name) } : {}),
    ...(tags.length > 0 ? { keywords: tags.map((t) => t.name).join(', ') } : {}),
    inLanguage: 'pt-BR',
    wordCount,
    isAccessibleForFree: true,
  }
}

export function breadcrumbJsonLd(params: {
  baseUrl: string
  trail: { name: string; path: string }[]
}): JsonLd {
  const { baseUrl, trail } = params

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  }
}

/**
 * Serializa o JSON-LD para dentro de uma <script>. O escape de `<` evita que um
 * título com HTML feche a tag script no meio do JSON.
 */
export function jsonLdScript(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
