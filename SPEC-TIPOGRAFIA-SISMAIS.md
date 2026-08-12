# SPEC — Tipografia Sismais e tabela `agent_configs`

Especificação técnica pra deixar o blog da Gestão Mais Simples com a tipografia da Sismais funcionando de
verdade, e pra corrigir uma tabela que o wizard não cria. Data: 12/08/2026. Tempo estimado: 1 hora.

Quem executa: a squad **A Ordem da Prensa** (`blog-dev-squad`), numa sessão aberta dentro de
`C:/apps/expxblog`. Este arquivo é autocontido, dá pra executar sem contexto de fora.

## 1. O problema

O painel do blog tem uma tela de Aparência que deixa configurar a fonte do site. Só que ela não funciona no blog público. Dois motivos, os dois no arquivo `app/globals.css`:

1. O arquivo carrega as fontes por um `@import` do Google Fonts escrito na mão, com Inter e Source Serif 4 apenas. Poppins não é carregada. Então escolher Poppins no painel não muda nada, porque a fonte não existe na página.
2. A regra `body` fixa `font-family: 'Inter', system-ui, sans-serif` direto no CSS, e a regra `.prose h1, .prose h2, .prose h3` fixa `font-family: 'Source Serif 4', Georgia, serif`. Nenhuma das duas usa as variáveis CSS `--font-sans` e `--font-serif` que o `app/layout.tsx` injeta a partir do banco. Resultado: o valor salvo no painel é escrito na página e ignorado pelo CSS.

Some-se a isso que o design system do blog só tem três fontes (`font_sans`, `font_serif`, `font_mono`) e não tem uma fonte de título separada. O padrão da Sismais é Poppins em título e Inter em corpo, então falta o campo.

## 2. O que muda, arquivo por arquivo

Uma mudança só, em 7 arquivos. Siga a ordem.

**1. `app/globals.css`**
- Trocar o `@import` do Google Fonts (hoje na linha 5) por um que traga Poppins (600 e 700) além de Inter (400, 500, 600, 700) e Source Serif 4. Manter `display=swap`.
- Trocar a regra `body` pra usar `font-family: var(--font-sans), system-ui, sans-serif`.
- Trocar a regra `.prose h1, .prose h2, .prose h3` pra usar `font-family: var(--font-display), var(--font-sans), sans-serif`.
- Manter tudo mais igual. Não mexer nas cores fixas do `:root`, porque o `layout.tsx` sobrescreve elas em runtime.

**2. `lib/settings.ts`**
- Adicionar `font_display: string` na interface `DesignSystem`, logo antes de `font_sans`.
- Adicionar `font_display: 'Poppins, system-ui, sans-serif'` no objeto `DEFAULT_DESIGN_SYSTEM`.

**3. `lib/settings-constants.ts`**
- Este arquivo tem uma cópia do `DEFAULT_DESIGN_SYSTEM`, usada por componente client. Adicionar o mesmo `font_display` aqui. As duas cópias precisam ficar iguais, senão o painel mostra um valor e o site usa outro.

**4. `app/layout.tsx`**
- No bloco que monta a string `cssVars`, adicionar a linha da variável nova: `--font-display:${design_system.font_display};`, junto das outras linhas de fonte.

**5. `app/api/admin/settings/route.ts`**
- No schema zod do design system, adicionar `font_display: z.string().max(200).optional()`, do mesmo jeito que `font_sans` já está.

**6. `app/admin/aparencia/ApparenceClient.tsx`**
- Na lista de campos de fonte, adicionar a entrada nova antes da fonte principal: `{ key: 'font_display' as const, label: 'Fonte dos títulos', placeholder: 'Poppins, system-ui, sans-serif' }`.

**7. `tailwind.config.ts`**
- Em `theme.extend.fontFamily`, adicionar `display: ['Poppins', 'system-ui', 'sans-serif']`.

**8. `drizzle/setup-sql.ts`** (problema separado, achado na mesma auditoria)
- A tabela `agent_configs` existe em `drizzle/schema.ts` mas **não** existe no `setup-sql.ts`, que é o arquivo
  que o wizard usa pra criar o banco. Em toda instalação nova a tabela não nasce, e salvar o prompt de um
  agente pelo painel quebra. Na leitura o erro é engolido por um `try/catch` em `lib/agent-configs.ts`, que
  volta pro prompt padrão, então a falha passa despercebida.
- Adicionar ao `setup-sql.ts` o SQL de criação, igual ao schema do Drizzle:

```sql
CREATE TABLE IF NOT EXISTS agent_configs (
  id text PRIMARY KEY,
  prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'openai/gpt-4o-mini',
  updated_at timestamp NOT NULL DEFAULT now()
);
```

- No banco de produção de hoje a tabela **já foi criada na mão**, em 12/08/2026, com os 8 prompts gravados.
  Esta mudança é pra próxima instalação não repetir o problema. Não precisa rodar nada no banco.
- Confira se tem outra tabela do `schema.ts` faltando no `setup-sql.ts`. Se tiver, adicione junto e liste na
  descrição do commit.

## 3. Regras do projeto

- Não rode `vercel deploy`. Deploy é só `git push origin master`.
- Não adicione a chave `crons` no `vercel.json`.
- Nunca use `as any` pra calar erro de TypeScript.
- Imports usam o alias `@/`, nunca `../../`.
- O projeto não tem teste automatizado. A verificação é `npm run lint` e depois `npm run build`. As duas precisam passar antes de dizer que acabou.

## 4. Checklist de verificação

- `npm run lint` sem erro.
- `npm run build` sem erro.
- `npm run dev`, abrir o blog, inspecionar um `h2` de artigo e conferir que a fonte computada é Poppins.
- Abrir `/admin/aparencia`, trocar a fonte dos títulos, salvar, recarregar o blog e ver a fonte mudar.
- Conferir que o corpo do texto continua em Inter.

## 5. O que NÃO faz parte desta spec

- Não muda cor no código.
- Não mexe no pipeline de IA.
- Não cria tabela no banco.
- Não publica artigo.

## 6. Valores da Sismais (configuração final no painel)

Depois que o código subir, a configuração no painel fica assim. Isso vai por fora, no painel, não no código.

| Campo | Valor |
|---|---|
| Fonte dos títulos | `Poppins, system-ui, sans-serif` |
| Fonte principal | `Inter, system-ui, sans-serif` |
| Cor primária | `#10293F` |
| Cor secundária | `#45E5E5` |