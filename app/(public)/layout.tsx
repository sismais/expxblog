import { Header } from '@/components/layout/Header'
import { PortalHeader } from '@/components/layout/PortalHeader'
import { BusinessHeader } from '@/components/layout/BusinessHeader'
import { NewsHeader } from '@/components/layout/NewsHeader'
import { TechHeader } from '@/components/layout/TechHeader'
import { Footer } from '@/components/layout/Footer'
import { TechFooter } from '@/components/layout/TechFooter'
import { NewsletterSection } from '@/components/blog/NewsletterSection'
import { AnalyticsTracker } from '@/components/blog/AnalyticsTracker'
import { getSettings } from '@/lib/settings'
import { getAppUrl } from '@/lib/app-url'
import { organizationJsonLd, webSiteJsonLd, jsonLdScript } from '@/lib/structured-data'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSettings()
  const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
  const baseUrl = getAppUrl()
  return {
    title: { default: blogName, template: `%s | ${blogName}` },
    alternates: { types: { 'application/rss+xml': `${baseUrl}/feed.xml` } },
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { template, company, newsletter } = await getSettings()
  const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
  const logoUrl = company.logo_url
  const baseUrl = getAppUrl()

  // Identidade do site para buscadores e plataformas de IA. Fica no layout
  // público para valer em toda página do blog, não só no artigo.
  const siteJsonLd = jsonLdScript([
    organizationJsonLd({ baseUrl, blogName, company }),
    webSiteJsonLd({ baseUrl, blogName, description: company.blog_description }),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: siteJsonLd }}
      />
      {/* Fica no layout para contar a visita em toda página pública, não só no artigo. */}
      <AnalyticsTracker />
      {template === 'portal'
        ? <PortalHeader blogName={blogName} logoUrl={logoUrl} />
        : template === 'business'
          ? <BusinessHeader blogName={blogName} logoUrl={logoUrl} />
          : template === 'news'
            ? <NewsHeader blogName={blogName} logoUrl={logoUrl} />
            : template === 'tech'
              ? <TechHeader blogName={blogName} logoUrl={logoUrl} />
              : <Header blogName={blogName} logoUrl={logoUrl} />
      }
      <main
        className={`flex-1 w-full mx-auto px-4 py-8 ${
          template === 'portal' || template === 'business' || template === 'news' || template === 'tech'
            ? 'max-w-7xl'
            : 'max-w-6xl'
        }`}
      >
        {children}
      </main>
      {newsletter.enabled && (
        <div className={`w-full mx-auto px-4 ${
          template === 'portal' || template === 'business' || template === 'news' || template === 'tech'
            ? 'max-w-7xl'
            : 'max-w-6xl'
        }`}>
          <NewsletterSection title={newsletter.title} subtitle={newsletter.subtitle} />
        </div>
      )}
      {template === 'tech' ? (
        <TechFooter
          blogName={blogName}
          companyName={company.company_name}
          companyEmail={company.company_email}
          socialFacebook={company.social_facebook}
          socialInstagram={company.social_instagram}
          socialTwitter={company.social_twitter}
          socialYoutube={company.social_youtube}
        />
      ) : (
        <Footer
          blogName={blogName}
          blogDescription={company.blog_description}
          companyName={company.company_name}
          companyEmail={company.company_email}
          companyPhone={company.company_phone}
          companyAddress={company.company_address}
          companyCnpj={company.company_cnpj}
          socialFacebook={company.social_facebook}
          socialInstagram={company.social_instagram}
          socialTwitter={company.social_twitter}
          socialYoutube={company.social_youtube}
        />
      )}
    </div>
  )
}
