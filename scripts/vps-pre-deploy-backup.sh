#!/usr/bin/env bash
set -euo pipefail

# =================================================================
# Backup avant chaque deploy/migration :
#   1. la base PostgreSQL (format custom, restaurable via pg_restore)
#   2. les fichiers uploadés — CV/images et SCANS D'EXAMEN
#
# Les scans sont la preuve en cas de réclamation (arbitrage #95) : ils sont
# désormais persistés dans des volumes Docker (compose.prod.yml), et un volume
# non sauvegardé n'est pas de la persistance — c'est un sursis.
#
# Utilisé par GitHub Actions (.github/workflows/deploy.yml) AVANT
# `prisma migrate deploy`. Lancement manuel possible sur le VPS, ex. via cron :
#   0 3 * * * cd /home/audest/attestations-fsa && ./scripts/vps-pre-deploy-backup.sh
#
# Offsite chiffré (optionnel) — définir dans l'environnement :
#   BACKUP_REMOTE         destination rclone, ex: "spaces:fsa-backups"
#   BACKUP_AGE_RECIPIENT  clé publique age, ex: "age1..."
# Sans ces variables, le backup reste local uniquement.
# =================================================================

# Charge une config locale optionnelle (BACKUP_REMOTE, BACKUP_AGE_RECIPIENT…).
# Utilisée par le cron et la CI (les deux tournent sur le VPS en tant qu'audest).
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-$HOME/.config/attestations-fsa/backup.env}"
if [ -f "$BACKUP_ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$BACKUP_ENV_FILE"; set +a
fi

CONTAINER="${CONTAINER:-attestations-fsa-postgres-prod}"
APP_CONTAINER="${APP_CONTAINER:-attestations-fsa-prod}"
DB_NAME="${DB_NAME:-attestation_fsa}"
DB_USER="${DB_USER:-attestation_fsa_user}"
BACKUP_DIR="${BACKUP_DIR:-/home/audest/backups/attestation-fsa}"
KEEP="${KEEP:-10}"
REMOTE="${BACKUP_REMOTE:-}"
AGE_RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BASENAME="db-backup-$TIMESTAMP.dump"
BACKUP_FILE="$BACKUP_DIR/$BASENAME"

# Répertoires des volumes d'uploads à sauvegarder, tels que montés dans le
# conteneur applicatif (voir compose.prod.yml). Étiquette -> chemin.
UPLOAD_TARGETS=(
  "public:/app/public/uploads"
  "private:/app/private/uploads"
)

# Fail fast if the production container is not running.
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: container '$CONTAINER' is not running — cannot create backup." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

# --- Envoi offsite (optionnel), factorisé pour la base ET les fichiers ------
# $1 = fichier à envoyer. Envoie aussi son .sha256 s'il existe.
send_offsite() {
  local file="$1"
  [ -f "$file" ] || return 0

  if ! command -v rclone >/dev/null 2>&1; then
    echo "WARN: BACKUP_REMOTE défini mais rclone absent — offsite ignoré." >&2
    return 0
  fi

  local upload_file="$file"
  if [ -n "$AGE_RECIPIENT" ]; then
    if command -v age >/dev/null 2>&1; then
      age -r "$AGE_RECIPIENT" -o "$file.age" "$file"
      chmod 600 "$file.age" 2>/dev/null || true
      upload_file="$file.age"
    else
      echo "WARN: BACKUP_AGE_RECIPIENT défini mais age absent — envoi NON chiffré." >&2
    fi
  fi

  rclone copy "$upload_file" "$REMOTE" --no-traverse
  [ -f "$file.sha256" ] && rclone copy "$file.sha256" "$REMOTE" --no-traverse
  echo "==> Offsite upload OK -> $REMOTE ($(basename "$upload_file"))"
}

# =================================================================
# 1. BASE DE DONNÉES
# =================================================================
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

# =================================================================
# 2. FICHIERS UPLOADÉS (volumes)
# =================================================================
# Lus DEPUIS le conteneur applicatif (busybox tar est présent dans l'image
# alpine) : aucune image supplémentaire à tirer, et on archive exactement ce
# que le volume expose au chemin attendu.
if ! docker ps --format '{{.Names}}' | grep -qx "$APP_CONTAINER"; then
  echo "==> App container '$APP_CONTAINER' non démarré — fichiers NON sauvegardés." >&2
else
  for target in "${UPLOAD_TARGETS[@]}"; do
    label="${target%%:*}"
    dir="${target#*:}"
    vol_basename="uploads-$label-$TIMESTAMP.tar.gz"
    vol_file="$BACKUP_DIR/$vol_basename"

    if ! docker exec "$APP_CONTAINER" test -d "$dir" 2>/dev/null; then
      echo "==> $dir absent du conteneur — ignoré."
      continue
    fi

    # Rien à sauvegarder : on évite de produire des archives vides à chaque deploy.
    count=$(docker exec "$APP_CONTAINER" sh -c "find '$dir' -type f 2>/dev/null | wc -l" | tr -d ' \r')
    if [ "${count:-0}" -eq 0 ]; then
      echo "==> $dir vide (0 fichier) — rien à sauvegarder."
      continue
    fi

    echo "==> Archiving $dir ($count fichiers) -> $vol_file"
    # Échec BRUYANT : des fichiers existent, on ne peut pas continuer une
    # migration en les laissant sans sauvegarde.
    if ! docker exec "$APP_CONTAINER" tar czf - -C "$dir" . > "$vol_file"; then
      rm -f "$vol_file"
      echo "ERROR: échec de l'archivage de $dir — sauvegarde des fichiers impossible." >&2
      exit 1
    fi

    if [ ! -s "$vol_file" ]; then
      rm -f "$vol_file"
      echo "ERROR: archive vide pour $dir alors que $count fichiers existent." >&2
      exit 1
    fi

    ( cd "$BACKUP_DIR" && sha256sum "$vol_basename" > "$vol_basename.sha256" )
    chmod 600 "$vol_file" "$vol_file.sha256" 2>/dev/null || true
    echo "==> Archive OK: $vol_file ($(wc -c < "$vol_file") bytes)"
  done
fi

# =================================================================
# 3. OFFSITE (optionnel)
# =================================================================
if [ -n "$REMOTE" ]; then
  send_offsite "$BACKUP_FILE"
  for f in "$BACKUP_DIR"/uploads-*-"$TIMESTAMP".tar.gz; do
    [ -f "$f" ] && send_offsite "$f"
  done
else
  echo "==> Offsite non configuré (BACKUP_REMOTE vide) — backup local uniquement."
fi

# =================================================================
# 4. RÉTENTION LOCALE (couvre la base ET les fichiers)
# =================================================================
prune() {
  local pattern="$1"
  ls -1t "$BACKUP_DIR"/$pattern 2>/dev/null \
    | tail -n +$((KEEP + 1)) \
    | while IFS= read -r old; do rm -f "$old" "$old.sha256" "$old.age"; done || true
}

prune 'db-backup-*.dump'
prune 'uploads-*-*.tar.gz'

echo "==> Cleaned up old backups (kept last $KEEP of each kind)."
