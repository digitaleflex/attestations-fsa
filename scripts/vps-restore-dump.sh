#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Restore the SQL dump to your VPS PostgreSQL database
# Run this script ONCE after setup, when migrating from Prisma Postgres
# =================================================================

DUMP_FILE="${DUMP_FILE:-./Backup/dump-complet.sql}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERROR: Dump file not found: $DUMP_FILE"
  echo "Make sure to copy your dump to the VPS first, e.g.:"
  echo "  scp Backup/dump-complet.sql audest@your-vps:/home/audest/attestation-fsa/Backup/"
  exit 1
fi

echo "==> Restoring dump from $DUMP_FILE to database $DB_NAME..."

# Drop and recreate database to ensure clean state
sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
sudo -u postgres psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"

# Restore the dump
sudo -u postgres psql -d "$DB_NAME" -f "$DUMP_FILE"

echo "==> Restore complete."
echo ""
echo "You can verify with:"
echo "  sudo -u postgres psql -d $DB_NAME -c '\\dt'"
