# #20 — Identidade Sismais, SEO técnico e otimização para plataformas de IA

Data: 12/08/2026
Blog: Gestão Mais Simples (https://blog.gestaomaissimples.com.br)
Projeto Vercel: `gms-blog` · Projeto Supabase: `caooxkdszgeotqqmqrlm` (bloggms)

## O que estava quebrado

Auditoria feita no site em produção antes de mexer em qualquer coisa:

| Problema | Efeito |
|---|---|
| `NEXT_PUBLIC_APP_URL` não existia na Vercel | `getAppUrl()` caía no `VERCEL_URL`, que é a URL do deployment e muda a cada deploy. Todo canonical apontava para um endereço instável, diferente do domínio que serve o site |
| `/sitemap.xml` respondia 404 | O `robots.txt` declarava um sitemap inexistente |
| Nenhum JSON-LD no site | Nenhum sinal estruturado de artigo, autor, data ou marca para buscador ou plataforma de IA |
| Textos de outro blog chumbados no código | A home mostrava "Blog" e o rodapé "Tecnologia, gestão e inovação para empresas", enquanto o nome e a descrição certos já estavam no banco |
| Artigo em coluna `max-w-6xl` | Linha larga demais para leitura |
| `AnalyticsTracker` órfão | O componente existia mas não era usado em lugar nenhum: nenhum pageview era registrado |
| `design_system` no banco | `font_size_base` em 11px, `font_size_sm` em 8px, `font_serif` apontando para uma fonte mono e `background` em `#cab007` (herança do importador de design system) |
| 6 tabelas do `schema.ts` ausentes no banco | RSS, crawlers, `automation_logs` e `ai_request_logs` quebrariam em produção |

## O que foi feito

### Identidade visual
- **Header**: navy com acento cyan, categorias reais do banco, menu mobile sem JavaScript (`<details>` nativo, já que o Header é Server Component). Link quebrado `/categoria` removido.
- **Rodapé**: 3 colunas com navegação, contato real da empresa (e-mail, telefone e CNPJ formatados) e a descrição vinda do banco.
- **Home**: nome e descrição do banco, destaque do artigo mais recente na primeira página sem filtro.
- **Artigo**: coluna `max-w-3xl`, breadcrumb, autor, data, tempo de leitura, compartilhar (WhatsApp primeiro), relacionados e CTA final.
- **Tailwind**: as famílias de fonte passaram a apontar para as CSS vars do design system, então o que se configura em `/admin/aparencia` vale de verdade no site.
- **Contraste**: o botão da newsletter era cyan com texto branco, que reprova em WCAG AA. Virou branco com texto na cor primária, o que funciona nos cinco templates.

### SEO técnico
- `app/sitemap.ts` criado, com posts, categorias e tags.
- `getAppUrl()` passou a preferir `VERCEL_PROJECT_PRODUCTION_URL` antes de `VERCEL_URL`, e `NEXT_PUBLIC_APP_URL` foi cadastrada na Vercel.
- `generateMetadata` completo em home, categoria, tag e artigo: canonical, Open Graph e Twitter Card. Busca marcada `noindex`.
- `opengraph-image.tsx`: capa social gerada para post sem imagem própria.
- `AnalyticsTracker` ligado no layout público, cobrindo todas as páginas.

### GEO/AEO
- **JSON-LD**: `Organization` e `WebSite`+`SearchAction` no layout público, `BlogPosting` e `BreadcrumbList` no artigo.
- **robots.ts**: regras explícitas por bot, liberando busca em tempo real (`OAI-SearchBot`, `ChatGPT-User`, `Claude-User`, `Claude-SearchBot`, `PerplexityBot`). Bots de treino continuam liberados, com a distinção documentada no código.
- **llms.txt** dinâmico.
- **Prompts** do Copywriter, Reviewer e Headline pedindo a estrutura que LLM cita: resposta direta de 40 a 60 palavras, H2 como pergunta, lista e tabela, número com origem declarada.
- **Correção no Reviewer**: ele recebia o artigo com as tags removidas, ou seja, não enxergava H2, lista nem tabela, então não tinha como cobrar estrutura. Agora recebe o HTML.

### O que a pesquisa mudou no plano

Pesquisa de 12/08/2026, separando evidência de opinião de mercado:

- **Base do trabalho de estrutura**: paper GEO (arXiv 2311.09735, KDD 2024), que mediu até +40% de visibilidade em motor generativo com citação de fonte, estatística e clareza.
- **`llms.txt` entrou com expectativa baixa**: 408 acessos em 500 milhões de visitas de bot de IA, e o Google publicou em junho/2026 que ignora o arquivo. Ficou por ser barato de manter, não por promessa de resultado.
- **FAQPage não virou tarefa**: o Google descontinuou o rich result em 07/05/2026.

## Mudanças no banco (projeto `caooxkdszgeotqqmqrlm`)

- 🟢 Criadas as 6 tabelas que faltavam: `rss_feeds`, `rss_processed_items`, `automation_logs`, `source_crawlers`, `source_crawler_items`, `ai_request_logs`, com os índices do `schema.ts`.
- 🟡 `site_settings.design_system` e `theme_colors` com os valores Sismais, via `scripts/apply-brand-settings.ts`.
- 🟡 `agent_configs`: regras de estrutura acrescentadas ao fim dos prompts de `copywriter`, `reviewer` e `headline`, via `scripts/append-geo-rules.ts`. Os prompts originais foram preservados, o script é idempotente e imprime o valor anterior.

## Verificação

- `npm run lint` sem erro (só os warnings de `<img>` que já existiam)
- `npm run build` sem erro
- Navegação real no dev contra o banco de produção, conferindo home, artigo e rodapé
- Em produção, depois do deploy: canonical no domínio certo, `/sitemap.xml` com as URLs corretas, `/llms.txt`, `/robots.txt` com as regras por bot, JSON-LD com os 4 tipos e a capa social renderizando

## Pendente

- Enviar o sitemap no Google Search Console.
- O `CLAUDE.md` aponta o Supabase `poksrzponrqcfamcjbua`, mas o blog usa `caooxkdszgeotqqmqrlm`.
