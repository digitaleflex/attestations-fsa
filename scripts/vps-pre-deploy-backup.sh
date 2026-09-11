#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Backup PostgreSQL database before each deploy/migration
# Runs against the production Docker PostgreSQL container.
# Used by GitHub Actions (.github/workflows/deploy.yml) BEFORE
# `prisma migrate deploy`. Can also be run manually on the VPS,
# e.g. via cron:
#   0 3 * * * cd /home/audest/attestations-fsa && ./scripts/vps-pre-deploy-backup.sh
#
# Offsite chiffré (optionnel) — définir dans l'environnement :
#   BACKUP_REMOTE         destination rclone, ex: "spaces:fsa-backups"
#   BACKUP_AGE_RECIPIENT  clé publique age, ex: "age1..."
# Sans ces variables, le backup reste local uniquement.
# =================================================================

CONTAINER="${CONTAINER:-attestations-fsa-postgres-prod}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
BACKUP_DIR="${BACKUP_DIR:-/home/audest/backups/attestation-fsa}"
KEEP="${KEEP:-10}"
REMOTE="${BACKUP_REMOTE:-}"
AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BASENAME="db-backup-$TIMESTAMP.dump"
BACKUP_FILE="$BACKUP_DIR/$BASENAME"

# Fail fast if the production container is not running.
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: container '$CONTAINER' is not running — cannot create backup." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

echo "==> Creating pre-deploy backup (custom format): $BACKUP_FILE"
# Format custom (-Fc) : compressé + restauration sélective via pg_restore.
docker exec "$CONTAINER" pg_dump -Fc -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Guard against a truncated/empty dump.
if [ ! -s "$BACKUP_FILE" ]; then
  rm -f "$BACKUP_FILE"
  echo "ERROR: backup file is empty: $BACKUP_FILE" >&2
  exit 1
fi

# Checksum d'intégrité (vérifiable à la restauration).
( cd "$BACKUP_DIR" && sha256sum "$BASENAME" > "$BASENAME.sha256" )
chmod 600 "$BACKUP_FILE" "$BACKUP_FILE.sha256" 2>/dev/null || true

echo "==> Backup complete: $BACKUP_FILE ($(wc -c < "$BACKUP_FILE") bytes)"
echo "==> Checksum: $(cut -d' ' -f1 "$BACKUP_FILE.sha256")"

# --- Offsite chiffré (optionnel) ---------------------------------
if [ -n "$REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "WARN: BACKUP_REMOTE défini mais rclone absent — offsite ignoré." >&2
  else
    UPLOAD_FILE="$BACKUP_FILE"
    if [ -n "$AGE_RECIPIENT" ]; then
      if command -v age >/dev/null 2>&1; then
        age -r "$AGE_RECIPIENT" -o "$BACKUP_FILE.age" "$BACKUP_FILE"
        chmod 600 "$BACKUP_FILE.age" 2>/dev/null || true
        UPLOAD_FILE="$BACKUP_FILE.age"
      else
        echo "WARN: BACKUP_AGE_RECIPIENT défini mais age absent — envoi NON chiffré." >&2
      fi
    fi
    rclone copy "$UPLOAD_FILE" "$REMOTE" --no-traverse
    rclone copy "$BACKUP_FILE.sha256" "$REMOTE" --no-traverse
    echo "==> Offsite upload OK -> $REMOTE ($(basename "$UPLOAD_FILE"))"
  fi
else
  echo "==> Offsite non configuré (BACKUP_REMOTE vide) — backup local uniquement."
fi

# --- Rétention locale --------------------------------------------
ls -1t "$BACKUP_DIR"/db-backup-*.dump 2>/dev/null \
  | tail -n +$((KEEP + 1)) \
  | while IFS= read -r old; do rm -f "$old" "$old.sha256" "$old.age"; done || true

echo "==> Cleaned up old backups (kept last $KEEP)."
