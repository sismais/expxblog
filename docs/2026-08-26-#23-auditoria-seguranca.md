# #23 — Auditoria de segurança e correções

Data: 26/08/2026 · Branch: `feat/migracao-wp-import`

Auditoria em painel paralelo sobre três frentes: autenticação das rotas de API,
injeção/XSS/vazamento de segredo, e dependências. Cada achado passou por
verificação adversarial antes de virar código.

## Corrigido

### Banco (`enable_rls_on_remaining_tables`)

RLS estava desligado em `rss_feeds`, `rss_processed_items`, `automation_logs`,
`source_crawlers`, `source_crawler_items` e `ai_request_logs`. Quem tivesse a
anon key lia e escrevia nelas pela API REST do Supabase. Ligado nas seis.

O `drizzle/setup-sql.ts` não tinha uma linha de RLS, então instalação nova
nascia com as 19 tabelas abertas. Passou a ligar em todas.

O app não é afetado: fala com o banco por `DATABASE_URL` (Drizzle, role
postgres) e por service role key no Storage, e os dois passam por cima do RLS.
Os únicos dois `createClient` do repo usam service role, nenhum usa anon key.

### Escalação de privilégio pelo link de pré-visualização

O token do link de revisão era assinado com o mesmo `JWT_SECRET` do cookie
`auth_token`, e `verifyToken` só checava se o payload existia. Colar o token do
link no cookie dava acesso total a `/api/admin/*` por 10 minutos — incluindo a
listagem de `api_tokens`, que devolve os bearers em claro.

O preview passou a usar chave derivada (`sha256(JWT_SECRET + ':preview')`), o
que torna o cruzamento impossível sem depender de alguém lembrar de conferir
claim. E `verifyToken` passou a exigir `userId` numérico.

### Segredo de assinatura publicado no repositório

`process.env.JWT_SECRET ?? 'fallback-secret-must-change-in-prod-32chars'` existia
em quatro cópias. Sem a env var, o sistema assinava sessão com uma string que
está no GitHub, em silêncio. Agora exige 32 caracteres ou falha.

A leitura é preguiçosa de propósito: throw no topo do módulo quebraria o
`next build` na fase de coleta de rotas, e o wizard grava o `JWT_SECRET` na
Vercel só depois do primeiro deploy — o build travaria antes do `/setup`
existir. Mesmo motivo do Proxy preguiçoso em `drizzle/db.ts`.

Conferido: `JWT_SECRET` está nos escopos Production e Preview da Vercel.

### `/api/admin/*` sem verificação antes da instalação

`/api/admin/...` não casa com `startsWith('/admin')`, então caía no
`NextResponse.next()` do middleware. Passou a devolver 503.

### Duas cópias de `verifyToken`

`lib/auth.ts` tinha uma implementação própria, usada por `app/admin/layout.tsx`,
`/api/admin/upload` e `/api/admin/ai/image/generate`. Não era explorável (os três
caem no matcher do middleware), mas qualquer rota futura fora do matcher
reabriria o buraco. `lib/auth.ts` agora re-exporta de `lib/jwt.ts`.

### XSS pelo design system

`app/layout.tsx` montava o `<style>` das CSS vars concatenando 28 valores crus de
`site_settings`. O design system pode ser importado de site de terceiro e o zod
só limitava tamanho, então um `font-family` com `</style><script>` virava XSS em
toda página do blog, pública inclusive. Cada valor passa por `cssValue()`, que
também cobre o que já está gravado.

### SSRF na importação de design system

`extract` e `fetch-logo` faziam `fetch` de URL arbitrária validando só o
protocolo, e devolvem o conteúdo baixado na resposta. `lib/safe-url.ts` resolve
o host por DNS e recusa faixa privada, loopback, link-local, CGNAT e IPv4
mapeado em IPv6.

### Headers de usuário na resposta

O middleware fazia `response.headers.set('x-user-id'|'x-user-email')`, ou seja,
header de resposta: expunha o e-mail do admin ao cliente e não entregava nada ao
route handler. Passou a injetar no request, que é o que o `CLAUDE.md` já
descrevia.

### Dependências

`sanitize-html` 2.17.3 → 2.17.7. A 2.17.3 tem GHSA-rpr9-rxv7-x643 (crítico, XSS
armazenado por passthrough de raw-text em `<xmp>`) e validação incompleta de
esquema de URI, que deixava `javascript:` passar em atributo. É a barreira única
de XSS do projeto, usada nas 4 rotas de post e no publisher.

De 7 vulnerabilidades de produção (1 crítica, 5 altas) para 2 altas.

### Bot do Telegram aberto

`allowed_chat_ids` vazio era tratado como "todo mundo pode". O bot está
desligado hoje (token vazio), mas ao ligar qualquer pessoa geraria artigo e
queimaria crédito de IA. Lista vazia não libera mais ninguém.

### Enumeração na newsletter

`/api/newsletter` respondia 409 para e-mail já inscrito e 200 para novo, o que
deixava descobrir quem está na lista testando endereço por endereço. Resposta
agora é sempre igual.

### `INTERVAL` sem parametrizar

`getMostViewedPosts` montava `INTERVAL '${days} days'` com o placeholder dentro
do literal, então o bind nunca acontecia. Não era injeção (o único chamador passa
a constante 30), mas viraria no dia em que o valor viesse da URL.

### Upload aceitava o que o cliente declarasse

`file.type` vem do multipart e a extensão vem do nome do arquivo. Como o bucket
é público, dava para subir SVG com `<script>` declarado como imagem e servi-lo
inline a partir de `*.supabase.co`. O `fetch-logo` era pior: forçava
`image/svg+xml` quando a URL terminava em `.svg`, contra o que o servidor
remoto respondeu.

`lib/upload-guard.ts` detecta por magic bytes, deriva a extensão do tipo
detectado e recusa SVG com script, atributo de evento, `foreignObject`,
entidade externa ou link `javascript:`. Recusa em vez de limpar: logo legítimo
não usa nada disso, e remoção na marra deixa passar variação com entidade.
Validado em 14 casos.

O bucket também ganhou `file_size_limit` de 5 MB e `allowed_mime_types`, que
eram `null`. Os 144 objetos atuais têm no máximo 1,5 MB, e os cinco tipos batem
com o que `scripts/migracao-wp/migrate-images.ts` sobe.

### Bearer de API na listagem

`GET /api/admin/api-tokens` devolvia o token completo de todos os registros em
toda listagem, e o `PUT` fazia `.returning()` sem colunas. A tela já mascarava e
já avisava "copie agora", então o valor trafegava à toa.

A verificação passou a ser por `token_hash` (SHA-256) e a listagem devolve
`token_preview`. A migration `api_tokens_hash_and_preview` fez o backfill, então
integração em uso continua autenticando — conferido que o SHA-256 do Node bate
com o do Postgres.

### Preset de sanitização em dez cópias

`lib/sanitize.ts` virou a fonte única. A cópia de `lib/agents/publisher.ts` já
tinha divergido: só ela permitia `rel` em `<a>`. O `rel` foi mantido no preset
central, porque link com `target="_blank"` precisa poder trazer `rel="noopener"`.

### Auth de cron byte a byte, erro cru em rota pública, e um segredo de mentira

Os três endpoints `/api/cron/*` repetiam o mesmo bloco comparando o bearer com
`!==`, que sai no primeiro byte diferente. `lib/cron-auth.ts` centraliza e usa
`timingSafeEqual`. Validado em 7 casos, incluindo chave errada de mesmo tamanho.

`/api/track` devolvia `details` com a mensagem do erro numa rota pública sem
auth — erro de banco cru descreve schema para quem está olhando. Fica só no log.

`CRON_SECRET` era gravada pelo wizard e lida por nenhum código: os crons
autenticam com a `SUPABASE_SERVICE_ROLE_KEY`. Saiu do wizard, do README e da
Vercel. Os `docs/2026-05-20-#15` e os planos em `docs/superpowers/` ainda a
citam, mas são registro do design original com Vercel Cron, que foi trocado por
pg_cron — ficam como estão.

## Não corrigido — fica para a próxima

### Segredos serializados no payload RSC da página de configurações

`app/admin/configuracoes/page.tsx` passa `ai_api_key`, bot token do Telegram,
Firecrawl e Pexels em texto claro como props do Client Component. Os quatro saem
no HTML da página, indo para cache de disco do navegador, proxy e "salvar
página".

Não mexido porque `ConfiguracoesClient.tsx` tem alteração não commitada da
sessão de migração. O padrão certo já existe no repo:
`app/api/admin/agents/extra/route.ts` devolve só `firecrawl_configured: boolean`.

Correção: passar `{ configured: boolean, masked: 'sk-or-…abcd' }` e ter endpoint
que grava a chave nova sem devolver a atual.

### Coluna `api_tokens.token` em claro — falta o último passo

Limpeza autorizada em 26/08/2026, e feita pela metade de propósito. A `master`
ainda roda `verifyApiToken` buscando por `apiTokens.token`, então limpar a coluna
antes do deploy derrubaria a API v1 do blog ao vivo na hora.

Já feito (migration `api_tokens_prepare_clear_plaintext`):

- `token` virou nullable, no banco, no `schema.ts` e no `setup-sql.ts`
- a criação de token não grava mais o valor em claro, só hash e preview
- trigger `api_tokens_fill_hash_trg` preenche `token_hash` e `token_preview` em
  qualquer INSERT. Sem ele, um token criado em produção antes do deploy nasceria
  sem hash e pararia de funcionar depois. Testado dentro de transação revertida

**Falta rodar, depois que esta branch chegar na `master` e a Vercel publicar:**

```sql
UPDATE api_tokens SET token = NULL WHERE token IS NOT NULL;
```

Antes de rodar, confirme que a integração "Hub ExpxAgents — A Ordem da Tinta"
tem o token guardado do lado dela. Depois disso o valor não existe mais em lugar
nenhum, e a única saída é gerar outro.

Continua sem `expires_at`.

### `ssl: { rejectUnauthorized: false }`

Está em `drizzle/db.ts`, `/api/admin/db-diag`, `/api/setup/test-db` e
`/api/setup/install` — é padrão do projeto inteiro, não só das rotas de setup.

Medido em 26/08/2026 contra o pooler de produção: `rejectUnauthorized: false` e
`ssl: 'require'` conectam; `ssl: true` e `'verify-full'` falham com
`self-signed certificate in certificate chain`. Ou seja, trocar por `'require'`
não ganharia nada — ele também não valida. A correção real é embarcar o CA do
Supabase e usar `{ ca, rejectUnauthorized: true }`, o que adiciona um arquivo
que expira e pede teste em produção.

*(o `CRON_SECRET` saiu desta lista — foi resolvido, veja acima)*

### `rewrite-links.ts` grava HTML sem re-sanitizar

`scripts/migracao-wp/rewrite-links.ts` interpola `resolved.href` cru dentro do
atributo e dá UPDATE em `posts.content` sem passar pelo `sanitize-html`. Risco
baixo (o JSON de triagem é curado), mas é o único caminho de escrita que fura o
preset. Arquivo da sessão de migração, não mexido.

### Next 14.2.35 sem backport de segurança

Está patchado para o CVE-2025-29927 (bypass de middleware, corrigido no
14.2.25). Mas a linha 14.x parou de receber backport: `GHSA-c4j6-fc7j-m34r`
(SSRF via WebSocket upgrade, CVSS 8.6) e outras só têm fix em 15.x/16.x.
Migrar é decisão de produto, não cabe num `audit fix`.
