# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regra de ouro — nunca peça ao usuário para rodar comandos

**Claude Code NUNCA deve pedir ao usuário que execute comandos manualmente.** Toda ação que pode ser executada por ferramenta deve ser executada por Claude:

- `git add`, `git commit`, `git push` — execute via Bash após qualquer alteração de código
- `npm run build`, `npm run lint` — execute via Bash para verificar antes de finalizar
- `npm run db:push` — execute via Bash quando houver mudança em `drizzle/schema.ts`
- SQL no Supabase — execute via MCP `execute_sql` / `apply_migration` com `project_id: "caooxkdszgeotqqmqrlm"` (projeto bloggms / Gestão Mais Simples)

Isso vale para todos os agentes especializados (`ai-pipeline`, `api-builder`, `admin-ui`, `db-engineer`, `cron-automator`, `public-frontend`). Nenhum agente deve encerrar uma tarefa listando "passos manuais" que o usuário precisa fazer — se há algo a executar, execute.

## Deployment

**Nunca faça deploy direto na Vercel.** Commit e push para o GitHub — a Vercel pega as mudanças sozinha pela integração.

```bash
git add <files>
git commit -m "message"
git push origin master
```

`vercel.json` é `{}` de propósito. **Nunca adicione a chave `"crons"`** — os crons rodam no Supabase (pg_cron + pg_net), não na Vercel.

## Commands

```bash
npm run dev            # Dev server em http://localhost:3000
npm run build          # Build de produção
npm run lint           # ESLint

npm run db:push        # drizzle-kit push — aplica o schema direto no banco (não gera arquivo de migration)
npm run db:studio      # Drizzle Studio
npm run db:seed        # tsx scripts/seed.ts — dados iniciais (só dev local)
npm run migrate:images # tsx scripts/migrate-images.ts — migra imagens locais para o Supabase Storage
```

Não existe suíte de testes. Verificação antes de finalizar = `npm run lint` + `npm run build`.

Não existem `db:generate` nem `db:migrate` neste projeto. O fluxo de schema é `drizzle-kit push`, e em produção as tabelas nascem do wizard de instalação (`drizzle/setup-sql.ts`, SQL direto sem CLI). Ao adicionar tabela ou coluna, atualize **os dois**: `drizzle/schema.ts` e `drizzle/setup-sql.ts` — senão instalações novas ficam sem a tabela.

## Architecture

**Stack**: Next.js 14 App Router · TypeScript strict · Tailwind · Drizzle ORM · PostgreSQL (Supabase) · Supabase Storage · OpenRouter

### Wizard de instalação — o gate que vem antes de tudo

`middleware.ts` checa `process.env.DATABASE_URL` **antes** de qualquer verificação de auth:

- Sem `DATABASE_URL` → todo `/admin/*` redireciona para `/setup`
- Com `DATABASE_URL` → `/setup` fica bloqueado e o fluxo normal de auth segue

O wizard em `app/setup/` + `app/api/setup/*` recebe token da Vercel e credenciais do Supabase, cria as tabelas, cria o admin, grava as env vars na Vercel via API e dispara redeploy. `JWT_SECRET` é gerado no wizard. Rotas `/api/setup/*` devem se auto-bloquear quando o sistema já está instalado.

### Route groups

- `app/(public)/` — blog público. Server Components com **queries Drizzle diretas** (`lib/db-queries.ts`), sem camada de fetch HTTP.
- `app/admin/` — painel protegido. Shell `page.tsx` (Server Component fino) + `*Client.tsx` (`'use client'`) que fala com `/api/admin/*`. **Nunca Drizzle direto em página admin.**
- `app/api/` — REST. Grupos com regras de auth distintas (tabela abaixo).
- `app/setup/` — wizard, acessível só antes da instalação.
- `app/docs/` + `app/api/v1/docs` — documentação da API pública v1.

### Grupos de API e autenticação

| Grupo | Auth | Observações |
|---|---|---|
| `/api/posts` `/api/categories` `/api/tags` `/api/newsletter` `/api/settings` `/api/track` | nenhuma | sempre filtre `status = 'published'`; newsletter nunca devolve lista de e-mails |
| `/api/v1/*` | `verifyApiToken()` de `lib/api-auth.ts` — header `Authorization: Bearer blog_...` | CRUD de posts/categorias/tags para integrações |
| `/api/admin/*` | JWT pelo `middleware.ts` | não adicione guard manual; a exceção é `/api/admin/upload`, que lê o cookie direto porque recebe `FormData` |
| `/api/cron/*` | `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` | sempre `POST`, sempre `export const maxDuration = 300` |
| `/api/telegram/webhook` | secret do bot | entrada do bot de geração de artigos |
| `/api/setup/*` | nenhuma, mas bloqueada após instalação | |

Respostas: erro sempre `{ error: string }`; `POST` que cria → `201`; `DELETE` → `200 { success: true }`.

### Autenticação

JWT `jose` em cookie httpOnly chamado **`auth_token`** (24h). Assinatura/verificação em `lib/auth.ts` (`lib/jwt.ts` é uma cópia menor usada pelo middleware, que roda no Edge). O middleware injeta `x-user-id` e `x-user-email` e nunca devolve esses headers em resposta de API.

Rate limit de login (5 tentativas por IP / 15 min) mora **dentro de** `app/api/auth/login/route.ts`, num `Map` em memória — não em `lib/auth.ts`. É por instância serverless; não trate como garantia forte.

### Banco de dados

Schema em `drizzle/schema.ts`. Conexão em `drizzle/db.ts`: driver `postgres` com `max: 5`, `prepare: false`, exportado como `Proxy` preguiçoso (`db` e `client`) para não estourar no build quando `DATABASE_URL` ainda não existe. **Nunca** importe `postgres` direto em outro lugar.

Tabelas: `users`, `posts`, `categories`, `tags`, `post_categories`, `post_tags`, `site_settings`, `api_tokens`, `article_themes`, `page_views`, `newsletter_subscribers`, `automation_config`, `agent_configs`, `rss_feeds`, `rss_processed_items`, `automation_logs`, `source_crawlers`, `source_crawler_items`, `ai_request_logs`.

Regras que o código não deixa óbvias:
- Junction tables têm PK composta — nunca adicione `id` serial nelas
- `site_settings (key, value)` é onde vai **toda** configuração global — nunca crie tabela nova de config
- `agent_configs` guarda `prompt` + `model` por agente (id = slug do agente); estado de execução vai em `automation_logs`
- `automation_logs` e `ai_request_logs` são append-only
- `posts.status` é só `'draft' | 'published'`

### Conteúdo e sanitização

O corpo do post é HTML do TipTap (`components/blog/TiptapEditor.tsx`) ou saída da IA. Toda escrita passa por `sanitize-html` com o preset usado no projeto: `sanitizeHtml.defaults.allowedTags` + `['h2','h3','img']`, e `img: ['src','alt']` nos atributos. O mesmo preset está repetido em quatro rotas (`admin/posts`, `admin/posts/[id]`, `ai/article/generate`, `ai/article/generate-from-url`) — se mexer numa, mexa nas quatro. Slug sempre via `lib/slug.ts`.

Na renderização pública o HTML entra por `dangerouslySetInnerHTML` com `prose prose-lg font-serif` — o conteúdo já vem sanitizado do banco.

### Templates do blog público

`site_settings.active_template` escolhe o layout: `default` · `portal` · `news` · `business` · `tech`. `app/(public)/layout.tsx` e `page.tsx` fazem branch por template, escolhendo header/footer (`components/layout/*Header.tsx`) e card (`components/blog/PostCard*.tsx`). **Ao adicionar um template novo, atualize os dois arquivos** — cada um tem sua própria cadeia de condicionais.

### Design tokens

As cores da marca **não são hex fixo**. `tailwind.config.ts` mapeia `brand-primary`, `brand-secondary` e variantes para CSS vars (`--color-primary` etc.), injetadas em runtime a partir de `site_settings` (`lib/settings.ts` → `getSettings()`, `defaultColors(template)`). O padrão do template `default` é azul `#1A4FA0` / laranja `#F58A2D`, mas o admin pode trocar em `/admin/aparencia` (inclusive importando um design system de um site via `app/api/admin/design-system/extract`).

No JSX use sempre as classes de token (`bg-brand-primary`, `text-neutral-900`) — nunca hex hardcoded. Fontes: Inter (UI), Source Serif 4 (artigo), JetBrains Mono (código/slug). Ícones estilo Feather: `width="17" height="17"`, `strokeWidth="1.75"`, outline (nunca filled).

### IA / OpenRouter

**Todo recurso de IA passa por OpenRouter** (`https://openrouter.ai`). Nenhum SDK de provider direto — sem `openai`, sem `@anthropic-ai`, sem nada.

`lib/ai.ts` é o único ponto de entrada. Exporta `aiChat()`, `callOpenRouter()`, `callOpenRouterImage()`, `getAIApiKey()`, `getAIModelFromDB()`, `getDefaultModel()`, `getDefaultModels()`, `fetchAvailableModels()`, `fetchAvailableImageModels()`, `getPromptFromDB()`.

- **Chave de API**: `site_settings.ai_api_key`, configurada em `/admin/configuracoes`. **Nunca** leia de `process.env`.
- **Modelo por feature**: `site_settings.ai_models` (JSON `{ feature: model_id }`), com fallback no `DEFAULT_MODELS` de `lib/ai.ts`. Features atuais: `content_generation`, `image_description`, `image_generation`, `briefing_generation`, `prompt_generation`, `theme_suggestion`, `category_matching`, `url_extraction`.
- **Custo e observabilidade**: toda chamada grava em `ai_request_logs` (tokens, `cost_usd`, `cost_brl` via `lib/exchange-rate.ts`, duração, status). É fire-and-forget — falha de log nunca derruba a chamada. Dashboard em `/admin` (`ai-logs`).
- `callOpenRouter` injeta a data de hoje no system prompt e tem timeout de 300s.

**Adicionar uma feature de IA**: (1) chave nova em `DEFAULT_MODELS` de `lib/ai.ts`; (2) label em `FEATURE_LABELS` de `app/admin/configuracoes/ConfiguracoesClient.tsx`; (3) chame `aiChat(feature, messages, options?)`.

### Pipeline multi-agente

`lib/agent-pipeline.ts` orquestra 8 agentes de `lib/agents/`, nesta ordem imutável:

**Headline → Researcher → Analyst → Copywriter → Reviewer → CTA → Designer → Publisher**

- Só o **Publisher** escreve no banco. Nenhum outro agente persiste nada.
- O Copywriter recebe o consolidado do Analyst — nunca acessa URL direto.
- Loop Copywriter↔Reviewer: máximo `MAX_REVIEW_CYCLES` (3) — depois entrega o melhor rascunho.
- Aprendizado contínuo: o Reviewer extrai princípios genéricos de escrita, capados em `MAX_LEARNING_ITEMS` (10, FIFO), injetados no **system prompt** do Copywriter nas próximas execuções.
- Progresso vai por **SSE** (`createPipelineStream`), evento `{ stage, status, data? }` — nunca troque por WebSocket ou polling; o consumidor é `app/admin/artigos/AgentsSection.tsx`.
- Prompt e modelo de cada agente vêm de `agent_configs`, com fallback em `AGENT_DEFINITIONS` (`lib/agents/types.ts`).

### Automação e crons

Três endpoints, todos `POST` autenticados com o service role key:

| Endpoint | Job pg_cron | Frequência |
|---|---|---|
| `/api/cron/automation` | `automation-check-every-15min` | `*/15 * * * *` |
| `/api/cron/rss` | `rss-check-every-30min` | `*/30 * * * *` |
| `/api/cron/source-crawlers` | `source-crawlers-check-every-15min` | `*/15 * * * *` |

Os jobs são criados/removidos **por código**, em `lib/supabase-cron.ts` (`scheduleXCron()` / `unscheduleXCron()`), disparados quando o admin liga ou desliga a automação. `docs/supabase-cron-setup.sql` é a versão manual de referência (usa Vault). Falha de pg_cron é engolida de propósito — nunca deve quebrar o salvamento da configuração.

Regras do ciclo:
- Só roda se `automation_config.enabled = true` **e** `next_run_at <= now()`. Nunca remova esse duplo guard.
- Toda execução registra em `automation_logs` (`triggered_by`, `status`, `duration_ms`, `post_id` ou `error`).
- RSS: dedup por GUID (fallback `link`) em `rss_processed_items`; item com mais de 7 dias não entra no pipeline.
- Crawlers (`lib/source-crawlers/handlers/`: `github`, `docs`, `custom`) expõem `run()` e só são chamados pelo `runner.ts` — nunca direto de route handler. Crawler não chama IA, só coleta e normaliza.
- Firecrawl (`lib/firecrawl.ts`) é opcional: cheque `FIRECRAWL_API_KEY` antes de usar; ausência não é erro bloqueante.

`maxDuration = 300` em rotas longas — limite do plano Hobby da Vercel. Não suba esse valor.

### Uploads

Vão para o **Supabase Storage**, bucket `uploads` (`lib/supabase-admin.ts` → `getSupabaseAdmin()`, `STORAGE_BUCKET`). Não existe mais gravação em `public/uploads/`. Limite 5 MB, tipos `jpeg|png|webp|gif|svg+xml`.

Imagens remotas permitidas em `next.config.js`: `i.imgur.com`, `**.cloudinary.com`, `images.unsplash.com`, `**.supabase.co`. Nunca adicione `hostname: '*'`.

## Environment Variables

```
DATABASE_URL                    # Supabase PostgreSQL (pooler, porta 6543)
JWT_SECRET                      # mín. 32 chars
NEXT_PUBLIC_APP_URL             # base URL, usada também nas chamadas do pg_cron
NEXT_PUBLIC_BLOG_NAME
NEXT_PUBLIC_SUPABASE_URL        # Storage
SUPABASE_SERVICE_ROLE_KEY       # Storage + auth dos endpoints /api/cron/*
FIRECRAWL_API_KEY               # opcional
```

A chave do OpenRouter **não** é env var — mora em `site_settings.ai_api_key`. Em produção o wizard grava tudo isso na Vercel; localmente, copie `.env.example` para `.env`.

## Convenções

- Identificadores em inglês; mensagens de erro para o usuário em português (`"Erro ao salvar artigo"`)
- Imports por alias `@/` — nunca `../../`
- `strict: true` ligado; nunca `as any` para calar erro, corrija o tipo
- Prefira `type` a `interface` para shapes de dados; `interface` só quando precisa de herança
- Nunca retorne stack trace em produção — só `err.message` ou string genérica
- Route handler com mais de ~15 linhas de lógica extrai para `lib/`; query Drizzle com mais de 3 linhas vai para `lib/db-queries.ts`
- Admin: feedback só por toast `{ type: 'success' | 'error', msg: string }` sumindo em 3s — proibido `alert()`/`confirm()`; toda seção nova precisa de entrada em `navItems` de `app/admin/layout.tsx`
- Público: `generateMetadata()` obrigatório em página de post, categoria e tag; pageview é fire-and-forget

## Documentos do repositório

- `SPEC.md` — o que o produto faz, funcionalidade por funcionalidade. Consulte antes de mudar comportamento.
- `AGENTS.md` — mesmas regras em formato por submódulo, para agentes não-Claude (OpenCode, Codex).
- `.claude/rules/` — regras por domínio, carregadas automaticamente.
- `docs/` — um arquivo por entrega, no padrão `AAAA-MM-DD-#NN-assunto.md`. Ao concluir uma feature relevante, adicione o próximo número da sequência.
- `docs/bugs/` — registro de bugs investigados.
