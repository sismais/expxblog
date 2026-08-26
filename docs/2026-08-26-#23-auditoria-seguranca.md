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

### Tokens de API em texto puro, sem expiração

`api_tokens.token` guarda o bearer em claro, e `GET /api/admin/api-tokens` o
devolve inteiro em toda listagem, não só na criação. Não existe `expires_at`.

Correção: guardar `sha256(token)`, mostrar o valor só na resposta do POST,
listar prefixo `blog_xxxx…`, adicionar expiração. Quebra os tokens existentes,
então precisa de janela combinada.

### Upload confia no MIME e na extensão do cliente

`/api/admin/upload` usa `file.type` (vem do multipart, controlado por quem
envia) e `path.extname(file.name)`. SVG está em `ALLOWED_TYPES`, então dá para
subir SVG com `<script>` no bucket público, servido como `image/svg+xml` a
partir de `*.supabase.co`.

Correção: detectar pelos magic bytes, derivar a extensão do tipo detectado, e
para SVG sanitizar ou servir com `content-disposition: attachment`. Cuidado:
`fetch-logo` depende de aceitar SVG.

### Preset de sanitização repetido em 10 arquivos

O `CLAUDE.md` fala em 4, mas são 10. `lib/agents/publisher.ts` divergiu:
acrescenta `a: ['href','name','target','rel']`, que os outros nove não têm.

Correção: extrair para `lib/sanitize.ts` e importar nos 10.

### Bucket `uploads` sem limite próprio

`file_size_limit` e `allowed_mime_types` são `null` no bucket. Os 5 MB e os tipos
são validados só no route handler. Como só o service role escreve, é defesa em
profundidade, não buraco.

### `ssl: { rejectUnauthorized: false }`

`/api/admin/db-diag`, `/api/setup/test-db` e `/api/setup/install` aceitam
qualquer certificado na conexão com o Postgres. Trocar por `ssl: 'require'`
precisa de teste contra o pooler do Supabase antes.

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

### `CRON_SECRET` é variável morta

Está gravada na Vercel por `app/api/setup/install/route.ts`, mas nenhum código
lê. Os endpoints de cron autenticam com `SUPABASE_SERVICE_ROLE_KEY`. Ou o wizard
grava lixo, ou a documentação e o código divergem.
