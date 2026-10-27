---
description: Restrições de segurança invioláveis para todos os agents
alwaysApply: true
---

# Segurança — Regras Invioláveis

## Secrets e credenciais
- Nunca leia `OPENROUTER_API_KEY` ou qualquer chave de IA de `process.env` — a chave vive em `site_settings.ai_api_key` e é lida via `getAIApiKey()` em `lib/ai.ts`
- Nunca logue `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` ou tokens JWT em console, resposta HTTP ou arquivo
- Nunca retorne `x-user-id` / `x-user-email` em respostas de API — esses headers são internos do middleware

## HTML e injeção
- Todo HTML fornecido pelo usuário ou gerado por IA **deve** passar por `sanitize-html` antes de ser persistido
- Preset em uso: `lib/sanitize.ts` (`sanitizeOptions` / `sanitizePostHtml`) — `sanitizeHtml.defaults.allowedTags` + `['h2','h3','img']`, com `img: ['src','alt']` e `a: ['href','name','target','rel']`; qualquer outra tag é stripped
- **Fonte única.** Importe de `@/lib/sanitize`, nunca redeclare o preset num arquivo novo. Cópia solta envelhece e vira buraco: até 26/08/2026 havia dez, e a de `lib/agents/publisher.ts` já tinha divergido das outras
- Ainda com cópia própria, a migrar quando a branch de migração fechar: `scripts/import-wp.ts` e `scripts/migracao-wp/refresh-content.ts`
- Nunca use `.innerHTML` sem sanitização em componentes React — use `dangerouslySetInnerHTML` apenas com output já sanitizado

## Imagens remotas
- Domínios autorizados em `next.config.js`: `imgur.com`, `cloudinary.com`, `unsplash.com`, `supabase.co`
- Nunca adicione `remotePatterns` genéricos (`hostname: '*'`) — adicione apenas domínios específicos justificados

## Autenticação
- Nunca implemente auth manual em `/api/admin/*` — o `middleware.ts` já protege todo esse grupo
- Nunca confie em `x-user-id` vindo do request body ou query string — apenas do header injetado pelo middleware
- Rate limit de login (5 tentativas / IP / 15min) está em `lib/auth.ts` — nunca remova ou aumente esse limite

## Deploy
- Nunca execute `vercel deploy` — o deploy é exclusivamente via `git push origin master`
