# #21 — Preparação técnica para a migração do WordPress

Data: 12/08/2026
Blog: Gestão Mais Simples (https://blog.gestaomaissimples.com.br)
Projeto Supabase: caooxkdszgeotqqmqrlm (bloggms)
Contexto: Sprint 3 do plano de migração dos ~240 posts do WordPress antigo (gestaomaissimples.com.br/blog).

## Decisão (via /prosseguir com painel + verificação adversarial)

Painel: Explore (estado do schema e do SEO) + especialista public-frontend (melhor prática de SEO para migração) + verificação adversarial que tentou refutar.

### Schema: coluna `legacy_url`
Adicionada coluna `legacy_url` (text, nullable) em `posts`, com índice `UNIQUE posts_legacy_url_uniq`. No PostgreSQL, UNIQUE em coluna nullable permite múltiplos NULL, então o índice deduplica só os posts efetivamente migrados do WP e garante 1:1 legacy→novo no próprio banco: reimportar o mesmo post falha no INSERT em vez de duplicar silenciosamente. Serve para a deduplicação da importação (S4.T1) e para o mapa de redirect 301 (S6.T1).
- `drizzle/schema.ts` e `drizzle/setup-sql.ts` atualizados em paralelo (regra do repo).
- Aplicado no banco de produção.

### Schema: coluna `meta_description` — DERRUBADA
O plano original (S3.T3) previa `legacy_url` + `meta_description`. A verificação adversarial derrubou `meta_description` com evidência direta no código: o admin já trata `excerpt` como campo de 160 chars (`maxLength={160}` em `app/admin/artigos/novo/page.tsx:92` e `editar/page.tsx:90`). Neste codebase, `excerpt` já é a meta description. Coluna dedicada criaria dois campos coexistentes com o mesmo propósito, ambiguidade de qual prevalece no `generateMetadata`, e exigiria zod em 4 rotas + input em 2 páginas de admin.
- Na importação, a meta description curada do Yoast vai gravada em `excerpt`.

### Auditoria S3.T2 — paridade SEO com Yoast
O Explore confirmou e o especialista validou: o blog novo já tem paridade técnica com o que o Yoast emite. Não há gap estrutural:
- `generateMetadata` completo em home, artigo, categoria e tag (canonical, Open Graph, Twitter Card).
- JSON-LD: Organization + WebSite (+SearchAction) no layout, BlogPosting + BreadcrumbList no artigo. O BlogPosting cobre headline, image, author, datePublished, dateModified, publisher, mainEntityOfPage, articleSection, inLanguage — tudo que o Yoast emite.
- `app/sitemap.ts`, `app/robots.ts` (com regras por bot de IA), `opengraph-image.tsx`, `feed.xml`, `llms.txt`.

Recomendações do especialista para a virada:
- Canonical self-referencing no novo, sempre. Nunca apontar o canonical do novo para o velho.
- 301 do WP velho para o novo é o que transfere a autoridade.
- Preservar `published_at` original e o slug exato do WP (mudar slug quebra backlinks).

## Bug do drizzle-kit push
`drizzle-kit push` (0.31.10) crasha neste projeto ao comparar o schema com o banco: `TypeError: Cannot read properties of undefined (reading 'replace')` em `bin.cjs:17861`, ao processar uma CHECK constraint existente. É bug da ferramenta, não do schema. Contorno: aplicar o DDL direto via MCP Supabase (`ALTER TABLE ... ADD COLUMN` / `CREATE INDEX`), mantendo `schema.ts` e `setup-sql.ts` como fonte da verdade do código. Registrado em memória para não repetir o diagnóstico.

## Segurança — exposição de credencial no log
Durante o diagnóstico do push, o traceback do driver `postgres` (ao receber uma URL inválida por erro de parsing do `.env`, que guarda a URL entre aspas) expôs a URL completa do banco, incluindo a senha. A senha não foi reproduzida em nenhum arquivo nem resposta. Recomendação: rotacionar a senha do projeto no painel do Supabase.

## Verificação
- `npm run lint` sem erro (só os warnings pré-existentes de `<img>`).
- `npm run build` sem erro.
- Banco: coluna `legacy_url` e índice `posts_legacy_url_uniq` confirmados via `information_schema` e `pg_indexes`.

## S3.T4 — Script de importação `scripts/import-wp.ts`

Importa o JSON do S1 (`data/wp-posts.json`) para o banco como `status='draft'`. Idempotente de verdade: re-rodar após corrigir o JSON **atualiza** posts já migrados em vez de só pular.

Fluxo do `processItem`:
1. `INSERT ... ON CONFLICT DO NOTHING (legacy_url)`. Se inseriu → amarra categoria/tags (`linkAll`) e retorna `inserted`.
2. Se conflitou em `legacy_url` (post já existe) → `UPDATE` dos campos editoriais (título, conteúdo, excerpt, `published_at`), **sem** tocar em `slug` (preserva a URL pública), `status` (não rebaixa a draft um post publicado manualmente), `cover_image` (S4.T2 cuida) e `legacy_url` (imutável); reconcilia as junctions (DELETE + `linkAll`, igual ao admin PUT) e retorna `updated`.
3. Colisão de `slug` com outro post (`legacy_url` diferente) → o INSERT lança violação de UNIQUE, capturada pelo `try/catch` do `main` como erro explícito. Não sufixa nem silencia, porque mudar a URL pública quebraria redirect 301 e backlinks.

Decisões técnicas (painel `/prosseguir` + verificação adversarial):
- **`cover_image` fica NULL no import.** `og_image` é URL do WP, fora dos `remotePatterns` do `next.config.js` (renderizaria como `<img>` cru, sem otimização) e quebraria quando o WP sair do ar (S6). S4.T2 baixa do próprio JSON fonte, re-hospeda no Supabase Storage e então preenche `cover_image`. O `main` conta quantos posts têm `og_image` e reporta como "capas pendentes".
- **Get-or-create por SLUG, não por name.** Premissa confirmada lendo o contrato real: `category` no JSON vem como o **slug da categoria extraído da URL do WP** (`extract.ts:135`, regex `/blog/{categoria}/{slug}/`), não como name. `normalizeCategorySlug` (mapa `CATEGORY_SLUG_FIXES`) corrige o typo conhecido "gestcao-e-negocios" → "gestao-e-negocios" antes de criar/linkar. As `tags`, por sua vez, vêm como name legível dos `meta[property="article:tag"]` (0 tags no acervo real — o WP não emitia `article:tag`), mas `generateSlug` normaliza igual.
- **Sem `db.transaction`.** Alinha ao resto do repo (não há transação em lugar nenhum); a idempotência por `legacy_url` + a reconciliação de junctions no UPDATE cobrem falhas parciais sem introduzir uma novidade.
- **Pendência editorial (S2):** o `name` da categoria criada fica igual ao slug (ex.: "gestao-e-negocios"), feio pra exibir como título. Reacentuar automaticamente é ambíguo; fica pra renomear no admin durante a triagem.

Verificação: `npx tsc --noEmit` sem erro; `npm run build` sem erro; `npm run lint` só nos warnings pré-existentes de `<img>`.

## Estado do plano de migração
- S1.T1 ✅ extrator (extract.ts + parse-post.ts; 224/224 extraídos, 16 descartadas /sistema/)
- S1.T2 ✅ normalização (shape `WpPost` ok)
- S3.T1 ✅ sitemap (na #20)
- S3.T2 ✅ auditoria (paridade confirmada)
- S3.T3 ✅ parcial (legacy_url feito; meta_description derrubada com razão)
- S3.T4 ✅ script de import idempotente
- S1.T3 (inventário xlsx), S1.T4 (GSC, bloqueada por credencial), S2 (triagem, gate de aprovação), S4, S5, S6 — pendentes. Dependem de acesso ao WordPress, Cloudflare e Search Console e do OK na triagem.
