#!/usr/bin/env bash
# Hook: api-builder/stop
# Antes de encerrar, checa violações de padrões críticos de API.

cd /Users/thuliobittencourt/Documents/Projetos/ExpxBlog

echo "[api-builder] Verificação final de rotas API..." >&2

# 1. Rotas de cron com GET em vez de POST?
CRON_GET=$(grep -r "^export async function GET" app/api/cron/ --include="route.ts" -l 2>/dev/null)
if [ -n "$CRON_GET" ]; then
  echo "BLOQUEADO [api-builder]: Rota de cron usando GET em vez de POST!" >&2
  echo "Arquivos: $CRON_GET" >&2
  echo "Cron endpoints DEVEM ser POST para evitar execução acidental via browser." >&2
  exit 2
fi

# 2. Rotas de cron sem maxDuration?
CRON_NO_DURATION=$(grep -rL "maxDuration" app/api/cron/ --include="route.ts" 2>/dev/null)
if [ -n "$CRON_NO_DURATION" ]; then
  echo "AVISO [api-builder]: Rotas de cron sem 'export const maxDuration = 300':" >&2
  echo "$CRON_NO_DURATION" >&2
fi

# 3. Vercel crons em vercel.json?
VERCEL_CRONS=$(grep -l '"crons"' vercel.json 2>/dev/null)
if [ -n "$VERCEL_CRONS" ]; then
  echo "BLOQUEADO [api-builder]: vercel.json contém a chave 'crons' — proibido neste projeto!" >&2
  echo "Use pg_cron no Supabase. Remova a chave 'crons' de vercel.json." >&2
  exit 2
fi

echo "[api-builder] Verificações de padrão OK." >&2
exit 0
