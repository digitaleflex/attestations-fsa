#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Clean the SQL dump to remove Prisma Postgres-specific extensions
# that don't exist in standard PostgreSQL.
# =================================================================

DUMP_FILE="${DUMP_FILE:-./Backup/dump-complet.sql}"
CLEANED_FILE="${CLEANED_FILE:-./Backup/dump-complet-clean.sql}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: Dump file not found: $DUMP_FILE"
  exit 1
fi

echo "==> Cleaning dump file: $DUMP_FILE -> $CLEANED_FILE"

node - <<NODE_SCRIPT
const fs = require('fs');
const input = fs.readFileSync('$DUMP_FILE', 'utf8');
const lines = input.split('\n');
const filtered = lines.filter(line => {
  const lower = line.toLowerCase();
  return !lower.includes('create extension if not exists prisma_postgres') &&
         !lower.includes('comment on extension prisma_postgres');
});
fs.writeFileSync('$CLEANED_FILE', filtered.join('\n'));
console.log('Cleaned ' + lines.length + ' lines -> ' + filtered.length + ' lines');
NODE_SCRIPT

echo "==> Cleaned dump saved to: $CLEANED_FILE"
