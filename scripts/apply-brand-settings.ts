/**
 * Aplica a identidade visual da Sismais em site_settings.
 *
 * Uso: npx tsx scripts/apply-brand-settings.ts
 *
 * O script é idempotente: faz merge por cima do que já está gravado e imprime o
 * valor anterior antes de escrever, para dar rollback manual se precisar.
 */
import 'dotenv/config'
import { db } from '../drizzle/db'
import { siteSettings } from '../drizzle/schema'
import { eq } from 'drizzle-orm'

const DESIGN_SYSTEM = {
  font_display: 'Poppins, system-ui, sans-serif',
  font_sans: 'Inter, system-ui, sans-serif',
  font_serif: '"Source Serif 4", Georgia, serif',
  font_mono: '"JetBrains Mono", monospace',
  font_size_base: '16px',
  font_size_sm: '14px',
  font_size_lg: '18px',
  font_size_xl: '20px',
  font_size_2xl: '24px',
  font_size_3xl: '30px',
  line_height_base: '1.75',
  font_weight_normal: '400',
  font_weight_medium: '500',
  font_weight_bold: '700',
  spacing_base: '4px',
  radius_sm: '4px',
  radius_md: '8px',
  radius_lg: '12px',
  radius_full: '9999px',
  color_text_primary: '#10293F',
  color_text_secondary: '#4B5563',
  color_border: '#E5E7EB',
  color_error: '#DC2626',
  color_success: '#16A34A',
  color_warning: '#D97706',
}

const THEME_COLORS = {
  primary: '#10293F',
  secondary: '#45E5E5',
  background: '#F9FAFB',
  surface: '#FFFFFF',
}

async function upsert(key: string, value: string) {
  const [existing] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1)

  if (existing) {
    console.log(`\n[${key}] valor anterior:\n${existing.value}`)
    await db
      .update(siteSettings)
      .set({ value, updated_at: new Date() })
      .where(eq(siteSettings.key, key))
  } else {
    console.log(`\n[${key}] não existia, criando`)
    await db.insert(siteSettings).values({ key, value, updated_at: new Date() })
  }
  console.log(`[${key}] novo valor gravado`)
}

async function main() {
  await upsert('design_system', JSON.stringify(DESIGN_SYSTEM))
  await upsert('theme_colors', JSON.stringify(THEME_COLORS))
  console.log('\nPronto.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Falhou:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
