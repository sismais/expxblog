#!/usr/bin/env bash
# Hook: db-engineer/stop
# Antes de encerrar, verifica se migrations foram geradas após mudanças no schema.

cd /Users/thuliobittencourt/Documents/Projetos/ExpxBlog

echo "[db-engineer] Verificação final do estado do banco..." >&2

# 1. Checa prepare: true em db.ts
PREPARE_TRUE=$(grep -n "prepare: true" drizzle/db.ts 2>/dev/null)
if [ -n "$PREPARE_TRUE" ]; then
  echo "BLOQUEADO [db-engineer]: 'prepare: true' detectado em drizzle/db.ts!" >&2
  echo "Isso quebra o Supabase connection pooler. Use prepare: false." >&2
  exit 2
fi

# 2. Checa se há imports de Drizzle em páginas admin (violação arquitetural)
DRIZZLE_IN_ADMIN=$(grep -r "from '@/drizzle\|from '../drizzle\|from '../../drizzle" app/admin/ --include="*.tsx" --include="*.ts" -l 2>/dev/null)
if [ -n "$DRIZZLE_IN_ADMIN" ]; then
  echo "BLOQUEADO [db-engineer]: Import de Drizzle em páginas admin detectado!" >&2
  echo "Arquivos: $DRIZZLE_IN_ADMIN" >&2
  echo "Admin pages nunca consultam o banco diretamente." >&2
  exit 2
fi

# 3. Verifica se schema.ts mudou mas não há migration nova (aviso)
SCHEMA_MODIFIED=$(git diff --name-only HEAD 2>/dev/null | grep "drizzle/schema.ts")
MIGRATION_NEW=$(git diff --name-only HEAD 2>/dev/null | grep "drizzle/migrations/")
if [ -n "$SCHEMA_MODIFIED" ] && [ -z "$MIGRATION_NEW" ]; then
  echo "AVISO [db-engineer]: drizzle/schema.ts foi modificado mas não há migration nova." >&2
  echo "Execute: npm run db:push" >&2
fi

echo "[db-engineer] Verificações de banco OK. Encerrando." >&2
exit 0
