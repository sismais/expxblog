---
description: Padrões específicos para drizzle/ e lib/db-queries.ts — complementa o agent db-engineer
globs:
  - "drizzle/**"
  - "lib/db-queries.ts"
---

# DB Engineer — Regras de Domínio

## Tabelas principais e relacionamentos
- `posts` ←→ `categories` via `post_categories` (junction, cascade delete em ambos os lados)
- `posts` ←→ `tags` via `post_tags` (junction, cascade delete em ambos os lados)
- `post_categories` e `post_tags` têm PK composta — nunca adicione coluna `id` serial a junction tables

## Campos obrigatórios em toda nova tabela
`id serial PRIMARY KEY`, `created_at timestamp DEFAULT now()`, `updated_at timestamp DEFAULT now()`

## Índices — regras implícitas que o código não deixa óbvias
- Toda coluna FK **já criada** sem índice explícito na junction table precisa de índice individual
- Colunas usadas em `WHERE` frequente (ex: `posts.status`, `posts.slug`, `posts.published_at`) precisam de índice
- Use índice parcial para queries de posts publicados: `WHERE status = 'published'`

## `site_settings` — tabela de configuração
Shape: `(key TEXT PRIMARY KEY, value TEXT)`. Chaves em uso:
- `ai_api_key` — chave OpenRouter
- `ai_models` — JSON `{ feature: model_id }`
- Qualquer nova configuração global vai aqui, nunca em nova tabela de config

## `agent_configs` — configuração dos agentes de IA
Shape: `(agent_name TEXT PRIMARY KEY, system_prompt TEXT, model TEXT)`. Nunca adicione coluna de estado de execução aqui — use `automation_logs`.

## `automation_logs` — imutável após escrita
Registros de log nunca são atualizados — apenas inseridos. Se precisar registrar conclusão, insira novo registro com status atualizado.

## Migrations
- Aplique mudanças de schema com `npm run db:push` (drizzle-kit push) — este projeto não usa arquivos de migration
- Migration com `ALTER TABLE ... ADD COLUMN NOT NULL` precisa de valor default ou deve ser feita em dois passos
- Execute `npm run db:push` via Bash — nunca liste esse comando como "passo manual"
- Toda tabela/coluna nova precisa ser adicionada TAMBÉM em `drizzle/setup-sql.ts` — é dele que nascem as tabelas no wizard de instalação

## Execução de SQL no Supabase
- Use `mcp__plugin_supabase_supabase__execute_sql` para executar SQL diretamente — nunca peça ao usuário para rodar SQL no dashboard do Supabase
- Use `mcp__plugin_supabase_supabase__apply_migration` para aplicar migrations remotamente quando necessário
