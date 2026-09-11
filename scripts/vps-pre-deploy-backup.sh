#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Backup PostgreSQL database before each deploy/migration
# Runs against the production Docker PostgreSQL container.
# Used by GitHub Actions (.github/workflows/deploy.yml) BEFORE
# `prisma migrate deploy`. Can also be run manually on the VPS,
# e.g. via cron:
#   0 3 * * * cd /home/audest/attestations-fsa && ./scripts/vps-pre-deploy-backup.sh
# =================================================================

CONTAINER="${CONTAINER:-attestations-fsa-postgres-prod}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
BACKUP_DIR="${BACKUP_DIR:-/home/audest/backups/attestation-fsa}"
KEEP="${KEEP:-10}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-backup-$TIMESTAMP.sql"

# Fail fast if the production container is not running.
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: container '$CONTAINER' is not running — cannot create backup." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "==> Creating pre-deploy backup: $BACKUP_FILE"
# Plain SQL format: easy to inspect/restore with psql.
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Guard against a truncated/empty dump.
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: backup file is empty: $BACKUP_FILE" >&2
  exit 1
fi

echo "==> Backup complete: $BACKUP_FILE ($(wc -c < "$BACKUP_FILE") bytes)"

# Keep only the last $KEEP backups to save disk space.
ls -1t "$BACKUP_DIR"/db-backup-*.sql | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "==> Cleaned up old backups (kept last $KEEP)."
