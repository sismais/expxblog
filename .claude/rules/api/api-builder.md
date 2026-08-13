---
description: Padrões específicos para app/api/ — complementa o agent api-builder
globs:
  - "app/api/**"
---

# API Builder — Regras de Domínio

## Grupos de rotas e autenticação
| Grupo | Auth | Observação |
|---|---|---|
| `/api/posts` `/api/categories` `/api/tags` `/api/newsletter` | Nenhuma | Sempre filtre `status = 'published'` |
| `/api/v1/*` | Bearer token via `verifyApiToken()` em `lib/api-auth.ts` | CRUD completo de posts |
| `/api/admin/*` | JWT via middleware | Não adicione guard manual — middleware já cobre |
| `/api/cron/*` | `SUPABASE_SERVICE_ROLE_KEY` como Bearer | Sempre `POST`, sempre `maxDuration = 300` |
| `/api/setup/*` | Bloqueado após configuração inicial | Verifique flag no DB antes de qualquer ação |

## Thin handler — nunca inline business logic
- Route handlers com mais de ~15 linhas de lógica devem extrair para `lib/`
- Queries Drizzle com mais de 3 linhas vão para `lib/db-queries.ts`

## Validação de entrada
- Use Zod para validar body em toda rota que persiste dados — nunca confie em `as SomeType`
- Valide na borda do sistema (route handler), não dentro das funções de `lib/`

## Respostas
- `POST` que cria recurso → `201` + objeto criado
- `DELETE` bem-sucedido → `200` + `{ success: true }` (não `204` — cliente precisa confirmar)
- Erro de validação → `400` + `{ error: "descrição do campo inválido" }`
- Recurso não encontrado → `404` + `{ error: "Not found" }`

## Newsletter
- Nunca retorne lista de e-mails em endpoints públicos — apenas count ou status de inscrição
