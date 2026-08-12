import type { Metadata } from 'next'
import './globals.css'
import { getSettings, darkenHex, lightenHex } from '@/lib/settings'
import { getAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSettings()
  const blogName = company.blog_name || process.env.NEXT_PUBLIC_BLOG_NAME || 'Blog'
  return {
    title: {
      template: `%s | ${blogName}`,
      default: blogName,
    },
    description: company.blog_description || 'Tecnologia, gestão e inovação para empresas',
    metadataBase: new URL(getAppUrl()),
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { template, colors, design_system } = await getSettings()

  const cssVars =
    `:root{` +
    `--color-primary:${colors.primary};` +
    `--color-primary-dark:${darkenHex(colors.primary)};` +
    `--color-primary-light:${lightenHex(colors.primary)};` +
    `--color-secondary:${colors.secondary};` +
    `--color-secondary-dark:${darkenHex(colors.secondary)};` +
    `--color-secondary-light:${lightenHex(colors.secondary)};` +
    `--color-bg:${colors.background};` +
    `--color-surface:${colors.surface};` +
    `--font-display:${design_system.font_display};` +
    `--font-sans:${design_system.font_sans};` +
    `--font-serif:${design_system.font_serif};` +
    `--font-mono:${design_system.font_mono};` +
    `--font-size-base:${design_system.font_size_base};` +
    `--font-size-sm:${design_system.font_size_sm};` +
    `--font-size-lg:${design_system.font_size_lg};` +
    `--font-size-xl:${design_system.font_size_xl};` +
    `--font-size-2xl:${design_system.font_size_2xl};` +
    `--font-size-3xl:${design_system.font_size_3xl};` +
    `--line-height-base:${design_system.line_height_base};` +
    `--font-weight-normal:${design_system.font_weight_normal};` +
    `--font-weight-medium:${design_system.font_weight_medium};` +
    `--font-weight-bold:${design_system.font_weight_bold};` +
    `--spacing-base:${design_system.spacing_base};` +
    `--radius-sm:${design_system.radius_sm};` +
    `--radius-md:${design_system.radius_md};` +
    `--radius-lg:${design_system.radius_lg};` +
    `--radius-full:${design_system.radius_full};` +
    `--color-text-primary:${design_system.color_text_primary};` +
    `--color-text-secondary:${design_system.color_text_secondary};` +
    `--color-border:${design_system.color_border};` +
    `--color-error:${design_system.color_error};` +
    `--color-success:${design_system.color_success};` +
    `--color-warning:${design_system.color_warning};` +
    `}`

  return (
    <html lang="pt-BR">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body
        className="text-neutral-900 antialiased"
        style={{ backgroundColor: 'var(--color-bg)', fontFamily: 'var(--font-sans)', fontSize: 'var(--font-size-base)' }}
        data-template={template}
      >
        {children}
      </body>
    </html>
  )
}
