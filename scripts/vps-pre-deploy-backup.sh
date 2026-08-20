#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Backup PostgreSQL database before each deploy/migration
# This script is run by GitHub Actions before prisma migrate deploy
# =================================================================

DB_NAME="${DB_NAME:-attestation_fsa}"
BACKUP_DIR="${BACKUP_DIR:-/home/audest/backups/attestation-fsa}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db-backup-$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "==> Creating pre-deploy backup: $BACKUP_FILE"
sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_FILE"

echo "==> Backup complete: $BACKUP_FILE"

# Keep only the last 10 backups to save disk space
ls -1t "$BACKUP_DIR"/db-backup-*.sql | tail -n +11 | xargs -r rm -f

echo "==> Cleaned up old backups (kept last 10)."
