/**
 * Importação de posts do WordPress para o banco do ExpxBlog.
 *
 * Passo S3.T4 da migração.
 *
 * Uso:
 *   npx tsx scripts/import-wp.ts [caminho/do/json]
 *
 * Default: ./data/wp-posts.json
 *
 * Regras:
 *  - Preserva o slug exato do WP (não regera).
 *  - Sanitiza o content_html com o preset do repo (sanitize-html).
 *  - excerpt vira meta_description (até 160 chars).
 *  - status SEMPRE 'draft' (gate editorial S2 decide publicação).
 *  - published_at preserva a data original do WP (ou now() se null).
 *  - Deduplicação por legacy_url (UNIQUE index posts_legacy_url_uniq).
 *  - Idempotente de verdade: re-rodar ATUALIZA posts existentes (título,
 *    conteúdo, excerpt, categoria/tags) em vez de só pular. Corrigir o JSON e
 *    re-rodar funciona.
 *  - Colisão de slug com outro post vira erro explícito (não sufixa nem
 *    silencia), porque mudar a URL pública quebraria redirect 301 e backlinks.
 *  - cover_image fica NULL aqui. A URL original do WP (og_image) não está nos
 *    remotePatterns do next.config (renderiza como <img> cru, sem otimização) e
 *    quebraria quando o WP sair do ar (S6). S4.T2 baixa do próprio JSON fonte,
 *    re-hospeda no Supabase Storage e então preenche cover_image.
 *  - NÃO baixa/re-hospeda imagens (passo S4.T2 faz isso).
 *
 * Shape esperado do JSON (array de items ou { posts: [...] }):
 *   {
 *     "title": string,
 *     "slug": string,
 *     "content_html": string,
 *     "meta_description": string,
 *     "og_image": string | null,
 *     "published_at": string (ISO) | null,
 *     "legacy_url": string | null,
 *     "category": string,
 *     "tags": string[]
 *   }
 */
import 'dotenv/config'
import sanitizeHtml from 'sanitize-html'
import { readFile } from 'fs/promises'
import path from 'path'
import { db } from '../drizzle/db'
import { posts, categories, tags, postCategories, postTags } from '../drizzle/schema'
import { generateSlug } from '../lib/slug'
import { eq } from 'drizzle-orm'

const BATCH_LOG_EVERY = 20

/**
 * Slugs de categoria do WP que precisam de normalização antes de ir pro banco.
 * O WP antigo tinha um typo em "gestão e negócios" que gerou o slug errado.
 */
const CATEGORY_SLUG_FIXES: Record<string, string> = {
  'gestcao-e-negocios': 'gestao-e-negocios',
}

function normalizeCategorySlug(slug: string): string {
  return CATEGORY_SLUG_FIXES[slug] ?? slug
}

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h2', 'h3', 'img']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ['src', 'alt'],
  },
}

type WpPostInput = {
  title?: unknown
  slug?: unknown
  content_html?: unknown
  meta_description?: unknown
  og_image?: unknown
  published_at?: unknown
  legacy_url?: unknown
  category?: unknown
  tags?: unknown
}

type ItemResult =
  | { status: 'inserted' }
  | { status: 'updated' }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string }

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed === '' ? null : trimmed
}

function asStringOrEmpty(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

function asDateOrNow(v: unknown): Date {
  if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw) as unknown
}

function normalizeItems(payload: unknown): WpPostInput[] {
  if (Array.isArray(payload)) return payload as WpPostInput[]
  if (payload && typeof payload === 'object') {
    const maybe = payload as { posts?: unknown }
    if (Array.isArray(maybe.posts)) return maybe.posts as WpPostInput[]
  }
  throw new Error('unexpected-shape')
}

// Get-or-create por SLUG. O `category` do JSON vem como slug da URL do WP
// (ex.: "tecnologia", "gestao-e-negocios" — typo já corrigido por
// normalizeCategorySlug no processItem). categories tem UNIQUE em name E slug,
// então onConflictDoNothing cobre os dois; o SELECT final resolve o caso de já
// existir (re-rodada não duplica). As tags, por sua vez, vêm como name legível
// dos meta tags do WP, mas generateSlug normaliza pra slug do mesmo jeito.
async function ensureCategoryByName(name: string): Promise<number | null> {
  const cleanName = name.trim()
  if (cleanName === '') return null
  const slug = generateSlug(cleanName)
  if (slug === '') return null

  const [created] = await db
    .insert(categories)
    .values({ name: cleanName, slug })
    .onConflictDoNothing()
    .returning()
  if (created) return created.id

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1)
  return existing?.id ?? null
}

async function ensureTagByName(name: string): Promise<number | null> {
  const cleanName = name.trim()
  if (cleanName === '') return null
  const slug = generateSlug(cleanName)
  if (slug === '') return null

  const [created] = await db
    .insert(tags)
    .values({ name: cleanName, slug })
    .onConflictDoNothing()
    .returning()
  if (created) return created.id

  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1)
  return existing?.id ?? null
}

// Reconcilia categoria + tags de um post num único passe. Garante que a
// categoria e as tags existem (get-or-create por nome/slug) e cria as rows de
// junction. No caminho de update, as junctions velhas já foram apagadas antes
// (reconciliação, igual ao admin PUT em app/api/admin/posts/[id]/route.ts);
// aqui só re-insere as atuais.
async function linkAll(
  postId: number,
  categoryName: string | null,
  tagNames: string[]
): Promise<void> {
  if (categoryName !== null) {
    const categoryId = await ensureCategoryByName(categoryName)
    if (categoryId !== null) {
      await db
        .insert(postCategories)
        .values({ post_id: postId, category_id: categoryId })
        .onConflictDoNothing()
    }
  }
  for (const tagName of tagNames) {
    const tagId = await ensureTagByName(tagName)
    if (tagId !== null) {
      await db
        .insert(postTags)
        .values({ post_id: postId, tag_id: tagId })
        .onConflictDoNothing()
    }
  }
}

async function processItem(item: WpPostInput): Promise<ItemResult> {
  // 1. Chaves obrigatórias (title e slug são exigidos pelo schema).
  const title = asNonEmptyString(item.title)
  const slug = asNonEmptyString(item.slug)
  if (title === null || slug === null) {
    return { status: 'error', reason: 'título ou slug ausente no JSON' }
  }

  // 2. Normalização dos campos editoriais.
  // cover_image fica NULL aqui: og_image é URL do WP, fora dos remotePatterns
  // do next.config (renderizaria como <img> cru, sem otimização) e quebraria
  // quando o WP sair do ar (S6). S4.T2 re-hospeda do JSON fonte e preenche.
  const content = sanitizeHtml(asStringOrEmpty(item.content_html), sanitizeOptions)
  const excerpt = asStringOrEmpty(item.meta_description)
  const publishedAt = asDateOrNow(item.published_at)
  const legacyUrl = asNonEmptyString(item.legacy_url)
  const rawCategory = asNonEmptyString(item.category)
  const categoryName = rawCategory !== null ? normalizeCategorySlug(rawCategory) : null
  const tagNames = asStringArray(item.tags)

  // 3. TENTAR INSERT com onConflictDoNothing em legacy_url. Se já existe post
  //    com este legacy_url, nada é inserido e returning() vem vazio → vamos
  //    pro caminho de UPDATE. status SEMPRE 'draft' no insert (gate editorial
  //    S2 decide publicação). Slug tem UNIQUE no schema: se colidir com outro
  //    post (legacy_url diferente), o INSERT lança exceção de UNIQUE que o
  //    try/catch do main transforma em erro explícito. Não sufixamos nem
  //    silenciamos — mudar a URL pública quebraria redirect 301 e backlinks.
  const [inserted] = await db
    .insert(posts)
    .values({
      title,
      slug,
      content,
      excerpt,
      cover_image: null,
      legacy_url: legacyUrl,
      status: 'draft',
      published_at: publishedAt,
      updated_at: new Date(),
    })
    .onConflictDoNothing({ target: posts.legacy_url })
    .returning()

  if (inserted) {
    await linkAll(inserted.id, categoryName, tagNames)
    return { status: 'inserted' }
  }

  // 4. Conflito de legacy_url → post já existe. CAMINHO DE UPDATE.
  //    Se legacyUrl fosse null, o INSERT acima não teria conflitado (NULLs
  //    não são iguais no índice UNIQUE) e já teríamos retornado 'inserted'.
  //    Rede de segurança para tipos e race condition:
  if (legacyUrl === null) {
    return { status: 'skipped', reason: 'legacy_url não casa post existente' }
  }

  const [existing] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.legacy_url, legacyUrl))
    .limit(1)
  if (!existing) {
    return { status: 'skipped', reason: 'legacy_url não casa post existente' }
  }

  // Atualiza SÓ campos editoriais. NÃO toca em slug (preserva URL pública),
  // status (não rebaixa a draft um post publicado manualmente após o import),
  // cover_image (S4.T2 cuida) e legacy_url (imutável).
  await db
    .update(posts)
    .set({ title, content, excerpt, published_at: publishedAt, updated_at: new Date() })
    .where(eq(posts.id, existing.id))

  // Reconcilia junctions igual ao admin PUT (app/api/admin/posts/[id]/route.ts):
  // apaga as velhas e re-insere as atuais via linkAll.
  await db.delete(postCategories).where(eq(postCategories.post_id, existing.id))
  await db.delete(postTags).where(eq(postTags.post_id, existing.id))
  await linkAll(existing.id, categoryName, tagNames)
  return { status: 'updated' }
}

async function main(): Promise<void> {
  const argPath = process.argv[2] ?? './data/wp-posts.json'
  const filePath = path.resolve(argPath)

  let payload: unknown
  try {
    payload = await readJsonFile(filePath)
  } catch {
    console.error(
      `Arquivo ${argPath} não encontrado. Rode scripts/migracao-wp/extract.ts primeiro.`
    )
    process.exit(1)
  }

  let items: WpPostInput[]
  try {
    items = normalizeItems(payload)
  } catch {
    console.error(
      'Arquivo JSON com estrutura inválida. Esperado um array de posts ou { posts: [...] }.'
    )
    process.exit(1)
  }

  if (items.length === 0) {
    console.log('Nenhum post para importar.')
    process.exit(0)
  }

  console.log(`Iniciando importação de ${items.length} post(s) do WordPress...`)
  console.log('Todos os posts serão criados como rascunho (status=draft).')

  let inserted = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  let pendingCovers = 0
  const errorDetails: { title: string; reason: string }[] = []
  const skipDetails: { title: string; reason: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const titlePreview = asNonEmptyString(item.title) ?? '(sem título)'

    try {
      const result = await processItem(item)
      if (result.status === 'inserted' || result.status === 'updated') {
        if (result.status === 'inserted') inserted++
        else updated++
        if (asNonEmptyString(item.og_image) !== null) pendingCovers++
      } else if (result.status === 'skipped') {
        skipped++
        skipDetails.push({ title: titlePreview, reason: result.reason })
      } else {
        errors++
        errorDetails.push({ title: titlePreview, reason: result.reason })
      }
    } catch (err: unknown) {
      errors++
      const reason = err instanceof Error ? err.message : String(err)
      errorDetails.push({ title: titlePreview, reason })
    }

    if ((i + 1) % BATCH_LOG_EVERY === 0) {
      console.log(`... ${i + 1}/${items.length} processados`)
    }
  }

  console.log('\nResumo da importação:')
  console.log(`  ${inserted} inserido(s)`)
  console.log(`  ${updated} atualizado(s)`)
  console.log(`  ${skipped} pulado(s)`)
  console.log(`  ${errors} erro(s)`)
  if (pendingCovers > 0) {
    console.log(`  ${pendingCovers} post(s) com capa do WP pendente de re-hospedagem (S4.T2)`)
  }

  if (skipDetails.length > 0) {
    console.log('\nPulados:')
    for (const s of skipDetails) {
      console.log(`  - "${s.title}": ${s.reason}`)
    }
  }

  if (errorDetails.length > 0) {
    console.log('\nDetalhes dos erros:')
    for (const e of errorDetails) {
      console.log(`  - "${e.title}": ${e.reason}`)
    }
  }

  // Exit code sinaliza falha (útil pra orquestração/cron detectar).
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err: unknown) => {
  console.error('Erro fatal na importação:', err instanceof Error ? err.message : err)
  process.exit(1)
})
