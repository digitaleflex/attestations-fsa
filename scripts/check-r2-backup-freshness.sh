#!/usr/bin/env bash
# Contrôle cron/monitoring : alerte si la sauvegarde R2 locale est absente ou trop
# ancienne. Le contrôle est local et ne contient aucun secret.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/audest/backups/attestation-fsa}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-30}"
[ "$MAX_AGE_HOURS" -gt 0 ] 2>/dev/null || { echo "ERROR: MAX_AGE_HOURS doit être > 0" >&2; exit 2; }
[ -d "$BACKUP_DIR" ] || { echo "ALERTE: répertoire de sauvegarde absent: $BACKUP_DIR" >&2; exit 2; }

latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'r2-export-*.manifest.json' -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2- | head -n 1 || true)"
if [ -z "$latest" ]; then
  echo "ALERTE: aucun export R2 local dans $BACKUP_DIR" >&2
  exit 2
fi
age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest") ))
if [ "$age_seconds" -gt $((MAX_AGE_HOURS * 3600)) ]; then
  echo "ALERTE: export R2 trop ancien ($((age_seconds / 3600)) h > ${MAX_AGE_HOURS} h): $latest" >&2
  exit 2
fi
echo "OK: export R2 récent ($((age_seconds / 60)) min): $latest"
