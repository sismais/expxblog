#!/usr/bin/env bash
# Hook: cron-automator/post-tool-use
# Após editar rotas de cron, verifica padrões obrigatórios.

TOOL="$1"
TARGET="$2"

if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ] || [ "$TOOL" = "MultiEdit" ]; then

  # Checa novos arquivos de rota de cron
  if echo "$TARGET" | grep -qE 'app/api/cron/.*/route\.ts$'; then

    # 1. Deve ser POST, não GET
    HAS_POST=$(grep -n "^export async function POST" "$TARGET" 2>/dev/null)
    HAS_GET=$(grep -n "^export async function GET" "$TARGET" 2>/dev/null)
    if [ -z "$HAS_POST" ]; then
      echo "ERRO [cron-automator]: $TARGET não tem handler POST!" >&2
      echo "Cron endpoints DEVEM usar POST, não GET." >&2
      exit 2
    fi
    if [ -n "$HAS_GET" ]; then
      echo "AVISO [cron-automator]: $TARGET expõe GET além de POST — remova o handler GET de rotas de cron." >&2
    fi

    # 2. maxDuration obrigatório
    HAS_MAX_DURATION=$(grep -n "maxDuration" "$TARGET" 2>/dev/null)
    if [ -z "$HAS_MAX_DURATION" ]; then
      echo "ERRO [cron-automator]: $TARGET não tem 'export const maxDuration = 300'!" >&2
      echo "Adicione: export const maxDuration = 300" >&2
      exit 2
    fi

    # 3. Verificação de Bearer token obrigatória
    HAS_AUTH=$(grep -n "SUPABASE_SERVICE_ROLE_KEY\|authorization\|Bearer" "$TARGET" 2>/dev/null)
    if [ -z "$HAS_AUTH" ]; then
      echo "ERRO [cron-automator]: $TARGET não verifica o Bearer token!" >&2
      echo "Adicione verificação: authHeader !== \`Bearer \${serviceRoleKey}\`" >&2
      exit 2
    fi

    echo "[cron-automator] Rota $TARGET — padrões de cron OK." >&2
  fi

  # Vercel.json não pode ter chave 'crons'
  if echo "$TARGET" | grep -q "vercel\.json"; then
    CRONS_KEY=$(grep '"crons"' "$TARGET" 2>/dev/null)
    if [ -n "$CRONS_KEY" ]; then
      echo "BLOQUEADO [cron-automator]: vercel.json com chave 'crons' é proibido neste projeto!" >&2
      echo "Use pg_cron no Supabase. Remova a chave 'crons'." >&2
      exit 2
    fi
  fi
fi

exit 0
