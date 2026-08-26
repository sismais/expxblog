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

/**
 * Limpa um valor de CSS var antes dele entrar no <style> do layout.
 *
 * Os valores vêm de site_settings, e o design system pode ser importado de um
 * site de terceiro (/api/admin/design-system/extract). Sem isso, um valor com
 * `</style><script>` viraria XSS em toda página do blog, pública inclusive.
 *
 * Tira o que permite sair do valor ou do bloco, e mata url()/@import, que
 * vazariam dados para um servidor externo. Parênteses continuam passando
 * porque cor legítima pode vir como `rgb(16, 41, 63)`.
 */
function cssValue(value: unknown): string {
  return String(value ?? '')
    .replace(/[<>;{}\\]/g, '')
    .replace(/url\s*\(/gi, '')
    .replace(/@import/gi, '')
    .trim()
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { template, colors, design_system } = await getSettings()

  const cssVars =
    `:root{` +
    `--color-primary:${cssValue(colors.primary)};` +
    `--color-primary-dark:${cssValue(darkenHex(colors.primary))};` +
    `--color-primary-light:${cssValue(lightenHex(colors.primary))};` +
    `--color-secondary:${cssValue(colors.secondary)};` +
    `--color-secondary-dark:${cssValue(darkenHex(colors.secondary))};` +
    `--color-secondary-light:${cssValue(lightenHex(colors.secondary))};` +
    `--color-bg:${cssValue(colors.background)};` +
    `--color-surface:${cssValue(colors.surface)};` +
    `--font-display:${cssValue(design_system.font_display)};` +
    `--font-sans:${cssValue(design_system.font_sans)};` +
    `--font-serif:${cssValue(design_system.font_serif)};` +
    `--font-mono:${cssValue(design_system.font_mono)};` +
    `--font-size-base:${cssValue(design_system.font_size_base)};` +
    `--font-size-sm:${cssValue(design_system.font_size_sm)};` +
    `--font-size-lg:${cssValue(design_system.font_size_lg)};` +
    `--font-size-xl:${cssValue(design_system.font_size_xl)};` +
    `--font-size-2xl:${cssValue(design_system.font_size_2xl)};` +
    `--font-size-3xl:${cssValue(design_system.font_size_3xl)};` +
    `--line-height-base:${cssValue(design_system.line_height_base)};` +
    `--font-weight-normal:${cssValue(design_system.font_weight_normal)};` +
    `--font-weight-medium:${cssValue(design_system.font_weight_medium)};` +
    `--font-weight-bold:${cssValue(design_system.font_weight_bold)};` +
    `--spacing-base:${cssValue(design_system.spacing_base)};` +
    `--radius-sm:${cssValue(design_system.radius_sm)};` +
    `--radius-md:${cssValue(design_system.radius_md)};` +
    `--radius-lg:${cssValue(design_system.radius_lg)};` +
    `--radius-full:${cssValue(design_system.radius_full)};` +
    `--color-text-primary:${cssValue(design_system.color_text_primary)};` +
    `--color-text-secondary:${cssValue(design_system.color_text_secondary)};` +
    `--color-border:${cssValue(design_system.color_border)};` +
    `--color-error:${cssValue(design_system.color_error)};` +
    `--color-success:${cssValue(design_system.color_success)};` +
    `--color-warning:${cssValue(design_system.color_warning)};` +
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
