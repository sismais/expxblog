---
description: Convenções universais do projeto — valem para todos os agents
alwaysApply: true
---

# Convenções Gerais

## Autonomia total — nunca delegue ações ao usuário

**Todo agente deve executar tudo sozinho.** Nenhum agente deve encerrar uma tarefa listando comandos para o usuário rodar ou passos manuais que o usuário precise executar.

| Ação | Como executar |
|---|---|
| `git add / commit / push` | Bash — execute diretamente após qualquer alteração |
| `npm run build` | Bash — execute para verificar antes de finalizar |
| `npm run lint` | Bash — execute junto com o build |
| `npm run db:push` | Bash — execute ao alterar `drizzle/schema.ts` (não esqueça de espelhar em `drizzle/setup-sql.ts`) |
| SQL no Supabase | MCP `mcp__plugin_supabase_supabase__execute_sql` ou `apply_migration` |
| Configurar pg_cron | MCP `mcp__plugin_supabase_supabase__execute_sql` com o SQL do cron |

Se uma ação não pode ser executada por ferramenta disponível, diga isso explicitamente — mas nunca finalize uma tarefa com uma lista de "passos que o usuário precisa fazer".

## Nomes e idioma
- Mensagens de erro retornadas ao usuário em **português** (ex: `"Erro ao salvar artigo"`)
- Identificadores de código em inglês; comentários podem ser em português se forem necessários
- Slugs gerados via `lib/slug.ts` — nunca implemente lógica de slug inline

## Respostas de API
- Erros retornam `{ error: string }` com status HTTP adequado — nunca `{ message }` ou shape diferente
- Sucesso de criação retorna `201`; não retorne `200` em POST que cria recurso
- Nunca retorne stack trace em produção — apenas `err.message` ou string genérica

## TypeScript
- `strict: true` já está habilitado — nunca use `as any` para suprimir erro; corrija o tipo
- Prefira `type` a `interface` para shapes de dados locais; use `interface` apenas quando herança é necessária
- Imports de `@/` são aliases para a raiz do projeto — nunca use caminhos relativos com `../../`

## Banco de dados
- Pool configurado em `drizzle/db.ts`: `max: 5`, `prepare: false` — nunca altere sem justificativa explícita
- Queries reutilizáveis vão em `lib/db-queries.ts`, não inline em route handlers ou page components
- Status de post é enum `draft | published` — nunca use string literal fora desses dois valores

## Tokens de design
- `brand-primary`: `#1A4FA0` (azul) — botões primários, nav ativa, headings
- `brand-secondary`: `#F58A2D` (laranja) — badges, destaques, acentos
- `neutral-900`: `#1A1A2E` — texto principal
- Fontes: Inter (UI), Source Serif 4 (artigos), JetBrains Mono (código/slugs)
- Nunca use hex hardcoded no JSX — use as classes Tailwind dos tokens acima

## Ícones
- Estilo Feather: `width="17" height="17"`, `strokeWidth="1.75"`, `strokeLinecap="round"`, `strokeLinejoin="round"`
- Nunca use ícones filled (solid) — somente outline/stroke
