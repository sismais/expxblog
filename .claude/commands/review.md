# /review — Code Review contra SPEC.md e CLAUDE.md

Invoca o agente `code-reviewer` para auditar o diff atual (ou os arquivos mencionados) contra as regras do SPEC.md, CLAUDE.md e as convenções do projeto.

## O que este comando faz

1. Lê o `git diff HEAD` para identificar o que mudou
2. Carrega `SPEC.md` e `CLAUDE.md` como referência de regras
3. Percorre o checklist de revisão do agente `code-reviewer`
4. Classifica cada problema encontrado em três severidades:
   - **BLOQUEANTE** — deve ser corrigido antes do merge (segurança, auth, provider de IA errado, quebra em produção)
   - **IMPORTANTE** — deve ser corrigido; degrada correção, viola arquitetura ou vai causar problemas de manutenção
   - **SUGESTÃO** — melhoria opcional; drift leve de convenção que não quebra nada
5. Emite um **Summary** com contagem por severidade e um veredito de merge

## Uso

```
/review                    # Revisa o diff atual (git diff HEAD)
/review app/api/posts      # Revisa um arquivo ou diretório específico
/review --branch feat/xyz  # Revisa diff entre feat/xyz e master
```

## Formato de saída de cada achado

```
[SEVERITY] <título curto>
File: <caminho>:<linha>
Rule: <qual regra foi violada>
Detail: <o que está errado e por que importa>
```

## Regras que o reviewer verifica

- Arquitetura: admin pages devem ser shell Server Component + `*Client.tsx` via `/api/admin/*`
- IA: toda chamada de IA via `lib/ai.ts` (`callOpenRouter`, `aiChat`) — nenhum SDK direto
- Auth: `/api/admin/*` não reimplementa auth (middleware já cobre); `/api/v1/*` usa `verifyApiToken()`
- Crons: nunca em `vercel.json` — apenas pg_cron no Supabase
- API: POST de criação retorna 201; erros usam `{ error: string }`; público filtra `status = 'published'`
- Frontend: sem hex hardcoded — use tokens Tailwind; ícones Feather outline
- TypeScript: sem `as any`; sem imports relativos `../../` (use `@/`)
- Deploy: sem `vercel deploy` em scripts ou CI

---

**Agente**: `code-reviewer` (read-only — nunca modifica arquivos)
**Referências**: `SPEC.md`, `CLAUDE.md`, `.claude/rules/seguranca.md`, `.claude/rules/convencoes-gerais.md`
