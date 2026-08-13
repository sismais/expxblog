# ExpxBlog

Plataforma de blog com Next.js 14, Supabase e recursos de IA via OpenRouter. Setup completo pela UI — sem configuração manual de variáveis de ambiente.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript |
| Banco de dados | PostgreSQL via Supabase (Drizzle ORM) |
| Autenticação | JWT em cookie `httpOnly` (biblioteca `jose`) |
| Editor de conteúdo | Tiptap (rich text) |
| IA | OpenRouter — todos os recursos de IA passam por `https://openrouter.ai` |
| Upload de arquivos | Supabase Storage (bucket `uploads`) |
| Estilo | Tailwind CSS |
| Deploy | Vercel (via integração GitHub) |

---

## Instalação

### 1. Pré-requisitos

Você vai precisar de contas nos serviços:

- **Supabase** — [supabase.com](https://supabase.com) — banco de dados PostgreSQL + armazenamento de arquivos
- **Vercel** — [vercel.com](https://vercel.com) — hospedagem do Next.js
- **OpenRouter** *(opcional, necessário para recursos de IA)* — [openrouter.ai](https://openrouter.ai)

### 2. Deploy na Vercel

1. Faça um fork ou clone deste repositório para sua conta do GitHub.
2. Acesse [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório.
3. Não configure nenhuma variável de ambiente — o wizard faz isso.
4. Clique em **Deploy** e aguarde o build concluir.

### 3. Configurar o Supabase

Antes de rodar o wizard, crie o projeto no Supabase e o bucket de uploads:

#### 3.1 Criar projeto

1. Acesse [supabase.com](https://supabase.com) → **New project**.
2. Preencha nome, senha do banco e região. Aguarde o provisionamento (~2 min).

#### 3.2 Obter credenciais

Você vai precisar de três valores do Supabase:

**Database URL** (`Project Settings → Database → Connection string → URI`)
- Use a connection string do **pooler** na porta **6543**:
  ```
  postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
  ```

**Supabase URL** (`Project Settings → API → Project URL`)
- Formato: `https://xxxxxxxxxxxx.supabase.co`

**Service Role Key** (`Project Settings → API → service_role`)
- Clique em "Reveal" para exibir. Nunca exponha essa chave no frontend.

#### 3.3 Criar bucket de uploads

1. Vá em **Storage** → **New bucket**.
2. Nome: `uploads`. Marque como **Public bucket**.
3. Em **Storage → Policies**, adicione duas políticas no bucket `uploads`:
   - `INSERT` com target `service_role` e definição `true`
   - `SELECT` sem target (público) e definição `true`

> Alternativa rápida: clique em **Disable RLS** no bucket — adequado para projetos internos.

### 4. Wizard de instalação

1. Acesse o deploy na Vercel (ex.: `https://seu-projeto.vercel.app/admin`).
2. O sistema detecta que não está configurado e redireciona para `/setup`.
3. Siga os 6 steps do wizard:

| Step | O que fazer |
|------|-------------|
| **1 — Vercel** | Gere um Access Token em `vercel.com/account/tokens` e cole aqui |
| **2 — Supabase** | Cole as três credenciais do Supabase e clique em "Testar conexão" |
| **3 — Banco de dados** | Automático — o wizard cria todas as tabelas |
| **4 — Administrador** | Defina nome, email e senha do usuário master |
| **5 — Finalizando** | Automático — o wizard salva as env vars na Vercel e inicia um redeploy |
| **6 — Concluído** | Clique em "Acessar o painel" |

Após o wizard, o blog está pronto para uso. Não é necessário nenhum passo manual.

---

## Desenvolvimento local

Para rodar localmente, configure o `.env` manualmente:

```bash
cp .env.example .env
# edite o .env com suas credenciais do Supabase
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). O painel admin está em `/admin`.

> Em ambiente local, `DATABASE_URL` no `.env` já satisfaz a verificação do middleware — o wizard não aparece.

---

## Configurar a IA (OpenRouter)

Os recursos de IA (geração de artigos, títulos, SEO, imagens) exigem uma chave do OpenRouter — configurada pelo painel, sem variável de ambiente:

1. Crie uma chave em [openrouter.ai/keys](https://openrouter.ai/keys).
2. No painel admin, vá em **Configurações → IA (OpenRouter)**.
3. Cole a chave e salve.
4. Escolha o modelo por recurso conforme necessário.

---

## Comandos úteis

```bash
npm run dev          # Servidor de desenvolvimento (http://localhost:3000)
npm run build        # Build de produção
npm run lint         # ESLint

npm run db:push      # Aplica mudanças de schema direto no banco
npm run migrate:images # Migra imagens locais para o Supabase Storage
npm run db:studio    # Drizzle Studio — GUI visual do banco
npm run db:seed      # Popula o banco com dados de exemplo (só para dev local)
```

> Em produção, as tabelas são criadas pelo wizard (`drizzle/setup-sql.ts`). `db:push` e `db:seed` são para desenvolvimento local.

---

## Estrutura do projeto

```
├── app/
│   ├── (public)/              # Blog público
│   ├── admin/                 # Painel administrativo (protegido por JWT)
│   ├── setup/                 # Wizard de instalação
│   └── api/
│       ├── admin/             # Endpoints protegidos
│       ├── setup/             # Endpoints do wizard (bloqueados após instalação)
│       └── v1/                # API pública com autenticação por token
├── components/
│   ├── blog/                  # Componentes do blog público
│   ├── layout/                # Headers e footers por template
│   └── ui/                    # Componentes reutilizáveis
├── drizzle/
│   ├── schema.ts              # Definição das tabelas
│   ├── db.ts                  # Conexão com o banco
│   ├── setup-sql.ts           # SQL de criação das tabelas (usado pelo wizard)
│   └── migrations/            # Migrations geradas pelo Drizzle (uso local)
├── lib/
│   ├── ai.ts                  # Integração com OpenRouter
│   ├── auth.ts                # JWT: assinar e verificar tokens
│   ├── settings.ts            # Configurações (site_settings)
│   ├── supabase-admin.ts      # Cliente Supabase para o servidor
│   └── automation.ts          # Automação de artigos com IA
├── middleware.ts               # Proteção das rotas + detecção do wizard
└── .env.example               # Template de variáveis (para dev local)
```

---

## Arquitetura

### Middleware e wizard

`middleware.ts` verifica `DATABASE_URL` antes de qualquer checagem de autenticação:
- Se ausente → redireciona `/admin/*` para `/setup`
- Se presente → bloqueia `/setup` e segue o fluxo normal de autenticação

As rotas `/api/setup/*` retornam 403 automaticamente se `DATABASE_URL` já estiver definida, impedindo que o wizard seja executado mais de uma vez.

### Autenticação

- JWT armazenado em cookie `httpOnly` com duração de 24h.
- Login tem rate limiting: 5 tentativas por IP a cada 15 minutos.
- `JWT_SECRET` e `CRON_SECRET` são gerados automaticamente pelo wizard com `crypto.randomBytes`.

### Banco de dados

- Schema em `drizzle/schema.ts` com tipagem TypeScript completa.
- Conexão via driver `postgres` com `max: 5` e `prepare: false` — necessário para ambientes serverless.
- Em produção, tabelas são criadas pelo wizard via `drizzle/setup-sql.ts` (SQL direto, sem CLI).

### IA (OpenRouter)

- Toda chamada de IA passa por `lib/ai.ts` → `callOpenRouter()`.
- Chave de API e modelos por recurso armazenados na tabela `site_settings`, configuráveis pelo painel admin.

### Upload de arquivos

- Uploads vão para o bucket `uploads` no Supabase Storage.
- Imagens externas permitidas de: `imgur.com`, `cloudinary.com`, `unsplash.com`, `supabase.co`.

---

## Licença

MIT
