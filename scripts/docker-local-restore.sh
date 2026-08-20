#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Restore the cleaned SQL dump to the local Docker PostgreSQL
# =================================================================

DUMP_FILE="${DUMP_FILE:-./Backup/dump-complet-clean.sql}"
POSTGRES_USER="${POSTGRES_USER:-attestation_fsa_user}"
POSTGRES_DB="${POSTGRES_DB:-attestation_fsa}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: Cleaned dump file not found: $DUMP_FILE"
  echo "Run ./scripts/fix-dump-for-local-postgres.sh first"
  exit 1
fi

echo "==> Restoring dump to local Docker PostgreSQL..."
docker compose -f compose.local.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP_FILE"

echo "==> Restore complete."
