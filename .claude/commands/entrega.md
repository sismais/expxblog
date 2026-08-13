# /entrega — Checklist de encerramento e relatório de próximos passos

Executa o protocolo completo de entrega: hooks de encerramento, verificação do PLAN.md, revisão final de código, geração de relatório e confirmação de que o projeto está pronto para ser clonado por outra pessoa.

## O que este comando faz

### Etapa 1 — Hooks de encerramento
Executa os hooks de pré-entrega configurados no projeto:
```bash
npm run build          # Verifica que o build de produção não quebra
npm run lint           # Garante que não há erros de lint
```
Se qualquer etapa falhar, **para aqui** e reporta o erro. Não avança para as próximas etapas.

### Etapa 2 — Verificação do PLAN.md
Lê o `PLAN.md` (se existir) e verifica o status de cada checkbox:
- Lista todas as tasks `[ ]` ainda abertas
- Lista todas as tasks `[x]` concluídas
- Se houver tasks abertas: reporta como pendências e pergunta se deve continuar mesmo assim
- Se não houver PLAN.md: pula esta etapa e registra no relatório

### Etapa 3 — Revisão final de código
Invoca o `code-reviewer` sobre o diff completo da branch atual em relação a `master`:
```bash
git diff master...HEAD
```
- **BLOQUEANTE** presente: **não emite o relatório de entrega** — lista os blockers e pede correção
- Apenas **IMPORTANTE/SUGESTÃO**: inclui no relatório como "débito técnico conhecido"

### Etapa 4 — Verificação de ambiente
Confirma que o projeto pode ser clonado e executado por outra pessoa:

```bash
# Verifica que .env.example existe e tem todas as variáveis obrigatórias
grep -E "DATABASE_URL|JWT_SECRET|NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_BLOG_NAME" .env.example

# Verifica que não há arquivos sensíveis commitados
git ls-files | grep -E "\.env$|\.env\.local$|\.env\.production$"

# Verifica que node_modules está no .gitignore
grep "node_modules" .gitignore

# Verifica que .env não está versionado
grep -E "^\.env$" .gitignore
```

### Etapa 5 — Relatório de próximos passos
Gera um relatório estruturado:

```
## Relatório de Entrega — <data>

### Status geral
[ APROVADO / PENDÊNCIAS ]

### O que foi implementado
- <lista do que foi feito nesta sessão>

### Passos manuais necessários
- [ ] SQL para rodar no Supabase: <lista de migrations ou pg_cron jobs>
- [ ] Variáveis de ambiente a configurar: <lista>
- [ ] Configurações no admin (/admin/configuracoes): <lista>

### Débito técnico conhecido
- IMPORTANTE: <lista de achados do code-reviewer>
- SUGESTÃO: <lista de achados do code-reviewer>

### Para clonar e rodar o projeto
1. cp .env.example .env
2. Preencher as variáveis em .env
3. npm install
4. npm run db:push
5. npm run db:seed
6. npm run dev

### Próximas features sugeridas (do backlog do PLAN.md)
- <tasks ainda abertas, se houver>
```

### Etapa 6 — Confirmação final
Pergunta ao usuário:
> "O relatório está correto? Posso confirmar a entrega?"

Se confirmado: registra no relatório que a entrega foi aprovada pelo usuário.

## Uso

```
/entrega                    # Executa o protocolo completo
/entrega --skip-review      # Pula a revisão de código (só para hotfixes urgentes)
/entrega --skip-build       # Pula o build (quando já foi verificado recentemente)
```

## Pré-condições

- Git working tree deve estar limpo (sem arquivos modificados não commitados) — ou o usuário deve confirmar que os cambios pendentes são intencionais
- `npm` deve estar disponível no PATH
- `PLAN.md` é opcional mas recomendado

---

**Agente de revisão**: `code-reviewer` (chamado automaticamente na Etapa 3)
**Referências**: `PLAN.md`, `SPEC.md`, `CLAUDE.md`, `.env.example`
