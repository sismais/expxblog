# #19 — Tipografia Sismais e tabelas faltando no setup-sql

Data: 12/08/2026
Spec de origem: `SPEC-TIPOGRAFIA-SISMAIS.md`

## Problema

A tela de Aparência deixava configurar a fonte, mas o blog público ignorava. Dois motivos, os dois em `app/globals.css`:

1. O `@import` do Google Fonts trazia só Inter e Source Serif 4. Poppins nem era carregada.
2. As regras `body` e `.prose h1, .prose h2, .prose h3` fixavam a fonte no CSS e não usavam as CSS vars que o `app/layout.tsx` injeta a partir do banco.

Junto disso, o design system não tinha uma fonte de título separada da fonte de corpo. O padrão Sismais é Poppins no título e Inter no corpo.

Problema separado, achado na mesma auditoria: `drizzle/setup-sql.ts` estava sete tabelas atrás do `drizzle/schema.ts`. Em instalação nova pelo wizard essas tabelas não nasciam.

## O que mudou

| Arquivo | Mudança |
|---|---|
| `app/globals.css` | `@import` passa a trazer Poppins (600, 700); `body` usa `var(--font-sans)`; `.prose h1/h2/h3` usa `var(--font-display), var(--font-sans)` |
| `lib/settings.ts` | Campo `font_display` na interface `DesignSystem` e no `DEFAULT_DESIGN_SYSTEM` (`Poppins, system-ui, sans-serif`) |
| `lib/settings-constants.ts` | Mesmo campo na cópia usada por componente client |
| `app/layout.tsx` | Injeta `--font-display` no bloco de CSS vars |
| `app/api/admin/settings/route.ts` | `font_display: z.string().max(200).optional()` no schema zod |
| `app/admin/aparencia/ApparenceClient.tsx` | Campo "Fonte dos títulos", antes da fonte principal |
| `tailwind.config.ts` | `fontFamily.display = ['Poppins', 'system-ui', 'sans-serif']` |
| `drizzle/setup-sql.ts` | Sete tabelas adicionadas (abaixo) |

## Tabelas adicionadas ao `setup-sql.ts`

`agent_configs`, `rss_feeds`, `rss_processed_items`, `automation_logs`, `source_crawlers`, `source_crawler_items`, `ai_request_logs` — com os índices correspondentes do `schema.ts`.

Todas com `CREATE TABLE IF NOT EXISTS`, então rodar o setup num banco já povoado não quebra nada. No banco de produção de hoje a `agent_configs` já tinha sido criada na mão em 12/08/2026, com os 8 prompts gravados. Nenhum SQL foi executado nesta entrega.

## Verificação

- `npm run lint` — sem erro (só os warnings de `<img>` que já existiam)
- `npm run build` — sem erro
- Dev server: o `<style>` do `<head>` traz `--font-display:Poppins, system-ui, sans-serif` e o CSS servido traz `font-family: var(--font-display), var(--font-sans), sans-serif` na regra dos títulos, com Poppins no `@import`

## Configuração final no painel (fora do código)

| Campo | Valor |
|---|---|
| Fonte dos títulos | `Poppins, system-ui, sans-serif` |
| Fonte principal | `Inter, system-ui, sans-serif` |
| Cor primária | `#10293F` |
| Cor secundária | `#45E5E5` |
