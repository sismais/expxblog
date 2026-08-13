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
- Preset em uso: `sanitizeHtml.defaults.allowedTags` + `['h2','h3','img']`, com `img: ['src','alt']` nos atributos — qualquer outra tag é stripped
- Esse preset está duplicado em `app/api/admin/posts/route.ts`, `app/api/admin/posts/[id]/route.ts`, `app/api/admin/ai/article/generate/route.ts` e `.../generate-from-url/route.ts` — ao mudar um, mude os quatro
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
