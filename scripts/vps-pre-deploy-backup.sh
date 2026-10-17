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
# Offsite chiffré — variables attendues dans BACKUP_ENV_FILE ou l'environnement :
#   BACKUP_REMOTE         destination rclone, ex: "spaces:fsa-backups"
#   BACKUP_AGE_RECIPIENT  clé publique age, ex: "age1..."
#
# L'offsite est FACULTATIF hors production (sauvegarde locale seule) et
# OBLIGATOIRE dès que NODE_ENV=production (voir enforce_offsite). Dans ce mode,
# une configuration incomplète ou un envoi en échec termine le script en code
# non nul : le déploiement s'arrête, l'échec est visible, et un envoi NON
# chiffré ne peut jamais partir.
# =================================================================

# Charge une config locale (BACKUP_REMOTE, BACKUP_AGE_RECIPIENT…).
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

# =================================================================
# OFFSITE — fail-closed dès que NODE_ENV=production
# =================================================================
# Indicateur : NODE_ENV=production, le marqueur production déjà utilisé par
# le dépôt (compose.prod.yml:48, deploy-to-vps.sh:165, .env.example:67,
# lib/auth.ts:30-34). Aucun indicateur n'est inventé ici.
#
# PORTÉE : la session SSH de `deploy.yml` et le cron n'exportent pas
# NODE_ENV ; ils chargent en revanche BACKUP_ENV_FILE (ci-dessus), lu avec
# `set -a`. Y écrire `NODE_ENV=production` rend donc le déploiement CI
# fail-closed SANS modifier le workflow. Voir docs/ops/procedures.md § 5.5.
#
# Hors production (développement, exécution locale, bancs d'essai), le
# comportement historique est conservé : sauvegarde locale seule, WARN et
# envoi non chiffré tolérés.
STRICT_OFFSITE=0
[ "${NODE_ENV:-}" = "production" ] && STRICT_OFFSITE=1

# Sort en non nul : le déploiement appelant s'arrête sur place (deploy.yml
# s'exécute sous `set -e`), et un ordonnanceur peut alerter sur l'échec.
offsite_refuse() {
  echo "ERROR: sauvegarde hors site EXIGÉE mais impossible — $1" >&2
  echo "       Backup local conservé dans $BACKUP_DIR, mais aucun deploy ne doit" >&2
  echo "       continuer sans copie hors site. Voir docs/ops/procedures.md § 5.5." >&2
  exit 1
}

# Vérifie la configuration AVANT de produire le dump : une configuration
# hors site cassée doit arrêter le déploiement immédiatement, pas après une
# sauvegarde locale que personne n'aura le temps de copier.
enforce_offsite() {
  if [ "$STRICT_OFFSITE" != "1" ]; then
    return 0
  fi
  if [ -z "$REMOTE" ]; then
    offsite_refuse "BACKUP_REMOTE absent ou vide (NODE_ENV=production)."
  fi
  command -v rclone >/dev/null 2>&1 \
    || offsite_refuse "rclone est introuvable dans le PATH — BACKUP_REMOTE=$REMOTE est inutilisable."
  if [ -z "$AGE_RECIPIENT" ]; then
    offsite_refuse "BACKUP_AGE_RECIPIENT absent ou vide — aucun envoi chiffré n'est possible."
  fi
  command -v age >/dev/null 2>&1 \
    || offsite_refuse "age est introuvable dans le PATH — un envoi NON chiffré ne partira pas."
  echo "==> Offsite EXIGÉ et configuré : $REMOTE (chiffré age pour $AGE_RECIPIENT)"
}

enforce_offsite

# --- Envoi offsite, factorisé pour la base ET les fichiers -----------------
# $1 = fichier à envoyer. Envoie aussi son .sha256 s'il existe.
# ÉCHEC = SORTIE NON NULLE dès qu'un envoi a été demandé : un upload qui rate
# en silence laisse croire à une sauvegarde qu'il n'y a pas.
send_offsite() {
  local file="$1"
  [ -f "$file" ] || return 0

  if ! command -v rclone >/dev/null 2>&1; then
    # Non atteignable si enforce_offsite est passé : il l'a déjà refusé.
    echo "WARN: BACKUP_REMOTE défini mais rclone absent — offsite ignoré." >&2
    return 0
  fi

  local upload_file="$file"
  if [ -z "$AGE_RECIPIENT" ]; then
    echo "WARN: BACKUP_AGE_RECIPIENT vide — envoi NON chiffré de $file." >&2
  elif command -v age >/dev/null 2>&1; then
    if ! age -r "$AGE_RECIPIENT" -o "$file.age" "$file"; then
      offsite_refuse "échec du chiffrement age de $(basename "$file") (clé publique invalide ?)."
    fi
    chmod 600 "$file.age" 2>/dev/null || true
    upload_file="$file.age"
  else
    # Non atteignable si enforce_offsite est passé : il l'a déjà refusé.
    echo "WARN: BACKUP_AGE_RECIPIENT défini mais age absent — envoi NON chiffré." >&2
  fi

  if ! rclone copy "$upload_file" "$REMOTE" --no-traverse; then
    offsite_refuse "échec de l'envoi de $(basename "$upload_file") vers $REMOTE."
  fi
  if [ -f "$file.sha256" ]; then
    if ! rclone copy "$file.sha256" "$REMOTE" --no-traverse; then
      offsite_refuse "échec de l'envoi du checksum $(basename "$file.sha256") vers $REMOTE."
    fi
  fi
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

# -----------------------------------------------------------------
# RESTAURABILITÉ — le filet ne vaut que s'il se déroule vraiment.
#
# Un dump tronqué ou corrompu est NON VIDE : il passe le garde `test -s`
# ci-dessus et laisse croire à une sauvegarde exploitable, alors qu'elle
# echouera au moment de la restauration, le jour ou on en aura besoin.
# On demande donc a PostgreSQL de lire l'archive (`pg_restore --list`)
# AVANT toute migration. Un fichier illisible arrete le deploy.
#
# Le dump est copie dans le conteneur (pg_restore doit y lire l'archive)
# puis supprime : le conteneur ne doit pas garder de copie de donnees
# personnelles en plus du dump deja present sur l'hote.
# -----------------------------------------------------------------
TMP_IN_CONTAINER="/tmp/$BASENAME.verify"
restore_check() {
  cleanup_and_fail() {
    docker exec "$CONTAINER" rm -f "$TMP_IN_CONTAINER" >/dev/null 2>&1 || true
    echo "ERROR: le dump $BACKUP_FILE n'est PAS restaurable." >&2
    echo "       Il est non vide mais PostgreSQL ne peut pas lire l'archive." >&2
    echo "       -> aucune migration ne doit partir sur cette base." >&2
    echo "       -> restaurer depuis l'offsite (voir docs/ops/fsa-reference-and-restore.md)" >&2
    echo "          puis relancer le deploy." >&2
    exit 1
  }

  if ! docker cp "$BACKUP_FILE" "$CONTAINER:$TMP_IN_CONTAINER" >/dev/null 2>&1; then
    cleanup_and_fail
    return 1
  fi

  # Une seule passe : lecture de l'archive + comptage, avant suppression.
  local listing entries
  if ! listing=$(docker exec "$CONTAINER" pg_restore --list "$TMP_IN_CONTAINER" 2>/dev/null); then
    cleanup_and_fail
    return 1
  fi
  entries=$(printf '%s\n' "$listing" | grep -c "TABLE DATA" || true)
  docker exec "$CONTAINER" rm -f "$TMP_IN_CONTAINER" >/dev/null 2>&1 || true

  echo "==> Restorability OK: archive lisible par pg_restore, $entries table(s)."

  # Une base reellement peuplee doit contenir des donnees. Un dump valide
  # mais sans aucune table indique un conteneur qui n'etait pas encore
  # monte au moment du pg_dump : la migration partirait sur une base vide.
  if [ "${entries:-0}" -lt 1 ]; then
    echo "ERROR: l'archive est lisible mais ne contient AUCUNE table." >&2
    echo "       -> le conteneur Postgres n'etait probablement pas pret" >&2
    echo "          au moment du pg_dump (base vide = perte de donnees)." >&2
    echo "       -> verifier 'docker ps $CONTAINER' et l'etat du volume," >&2
    echo "          puis relancer le deploy." >&2
    exit 1
  fi
}

restore_check

# =================================================================
# 2. FICHIERS UPLOADÉS (volumes)
# =================================================================
# Lus DEPUIS le conteneur applicatif (busybox tar est présent dans l'image
# alpine) : aucune image supplémentaire à tirer, et on archive exactement ce
# que le volume expose au chemin attendu.
# Fail-closed, exactement comme pour la base (l.55-59) : sans le conteneur
# applicatif on ne peut pas lire les volumes d'uploads. Previously ce cas se
# contentait d'un WARN et la sauvegarde CONTINUAIT — donc un deploy pouvait
# migrer le schéma avec des CV et des scans d'examen non sauvegardes. Perte
# de donnees silencieuse, y compris la piece a conviction d'un litige
# (arbitrage #95). On sort en erreur, sauf escape hatch explicite.
if ! docker ps --format '{{.Names}}' | grep -qx "$APP_CONTAINER"; then
  if [ "${ALLOW_UNBACKED_UPLOADS:-0}" = "1" ]; then
    echo "WARN: conteneur '$APP_CONTAINER' absent mais ALLOW_UNBACKED_UPLOADS=1" >&2
    echo "      -> les volumes d'uploads (CV, scans) NE SONT PAS sauvegardes." >&2
    echo "      -> a n'utiliser que si l'on sait qu'aucun upload n'existe." >&2
  else
    echo "ERROR: conteneur applicatif '$APP_CONTAINER' absent de" >&2
    echo "       -> sauvegarde des uploads (CV + scans d'examen) IMPOSSIBLE." >&2
    echo "       -> aucun deploy ne doit migrer le schema dans cet etat." >&2
    echo "       -> Remediation : demarrer le conteneur, ou exporter les volumes" >&2
    echo "          a la main, ou poser ALLOW_UNBACKED_UPLOADS=1 si et confirme" >&2
    echo "          qu'aucun upload n'existe. Voir docs/ops/procedures.md § 5.5." >&2
    exit 1
  fi
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
# 3. OFFSITE
# =================================================================
# Hors production, l'offsite reste facultatif. Dès qu'il est exigé
# (enforce_offsite), BACKUP_REMOTE est forcément non vide et send_offsite ne
# peut plus avaler un échec : chaque envoi qui rate termine le script en
# erreur, donc le job de déploiement en rouge.
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
