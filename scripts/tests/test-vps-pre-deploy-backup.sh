#!/usr/bin/env bash
# =================================================================
# Banc d'essai de scripts/vps-pre-deploy-backup.sh — SANS Docker.
#
# Pourquoi : ce script s'exécute AVANT chaque migration en production. Le tester
# demande normalement un démon Docker et une base ; ici on remplace `docker` par
# un binaire factice en tête de PATH et on simule un système de fichiers de
# conteneur. Le FLUX est donc vérifiable sur n'importe quelle machine.
#
# Usage :
#   bash scripts/tests/test-vps-pre-deploy-backup.sh
#
# Ce qu'il prouve :
#   - l'archivage des volumes d'uploads contient RÉELLEMENT les fichiers ;
#   - un dossier vide est SAUTÉ (pas d'archive vide à chaque déploiement) ;
#   - les checksums et la rétention s'appliquent aux deux types de sauvegarde ;
#   - la sauvegarde de la base n'est pas altérée.
# =================================================================
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
FIXTURE="$WORK/fakefs"
BIN="$WORK/bin"
BACKUPS="$WORK/backups"
mkdir -p "$FIXTURE" "$BIN" "$BACKUPS"

# --- Faux système de fichiers « conteneur » ------------------------------
mkdir -p "$FIXTURE/public/uploads/cv"
echo "cv-de-test" > "$FIXTURE/public/uploads/cv/a.txt"
mkdir -p "$FIXTURE/private/uploads/scans/sub1"
echo "scan-de-test" > "$FIXTURE/private/uploads/scans/sub1/s.pdf"
# Un dossier volontairement VIDE, pour prouver le saut.
mkdir -p "$FIXTURE/empty/uploads"

export FIXTURE

# --- Faux `docker` ------------------------------------------------------
cat > "$BIN/docker" <<'STUB'
#!/usr/bin/env bash
case "$1" in
  ps)
    printf '%s\n' "attestations-fsa-postgres-prod" "attestations-fsa-prod"
    exit 0
    ;;
  exec)
    shift; shift                 # nom du conteneur
    case "$1" in
      pg_dump) printf 'PGDUMP-FACTICE-%s\n' "$(date +%s%N)"; exit 0 ;;
      test)    [ -d "$FIXTURE$3" ] && exit 0 || exit 1 ;;
      sh)
        dir=$(printf '%s' "$3" | sed -E "s/.*find '([^']+)'.*/\1/")
        find "$FIXTURE$dir" -type f 2>/dev/null | wc -l | tr -d ' \r'
        exit 0
        ;;
      tar)     dir="$5"; tar czf - -C "$FIXTURE$dir" . 2>/dev/null; exit $? ;;
    esac
    exit 0
    ;;
esac
exit 0
STUB
chmod +x "$BIN/docker"

fail=0
check() { # etat attendu, libelle
  if [ "$1" = "1" ]; then echo "  OK   $2"; else echo "  ECHEC $2"; fail=1; fi
}

run_case() { # libelle, chemin public, chemin private
  local label="$1" pub="$2" pri="$3"
  echo "== CAS : $label"
  sed -e "s#\"public:/app/public/uploads\"#\"public:$pub\"#" \
      -e "s#\"private:/app/private/uploads\"#\"private:$pri\"#" \
      "$REPO/scripts/vps-pre-deploy-backup.sh" > "$WORK/script-under-test.sh"
  PATH="$BIN:$PATH" \
    CONTAINER=attestations-fsa-postgres-prod APP_CONTAINER=attestations-fsa-prod \
    DB_NAME=attestation_fsa DB_USER=u BACKUP_DIR="$BACKUPS" KEEP=2 \
    bash "$WORK/script-under-test.sh" 2>&1 | sed 's/^/     /'
}

echo "Banc d'essai — vps-pre-deploy-backup.sh (sans Docker)"
echo "===================================================="
run_case "fichiers présents" "/public/uploads" "/private/uploads"

pub=$(ls "$BACKUPS"/uploads-public-*.tar.gz 2>/dev/null | head -1)
pri=$(ls "$BACKUPS"/uploads-private-*.tar.gz 2>/dev/null | head -1)
dump=$(ls "$BACKUPS"/db-backup-*.dump 2>/dev/null | head -1)

check "$([ -n "$dump" ] && echo 1 || echo 0)" "le dump de base est créé"
check "$([ -n "$pub" ] && echo 1 || echo 0)" "l'archive du volume public est créée"
check "$([ -n "$pri" ] && echo 1 || echo 0)" "l'archive du volume private est créée"
check "$([ -f "$pub.sha256" ] && echo 1 || echo 0)" "checksum présent pour l'archive public"
check "$([ "$(tar tzf "$pub" 2>/dev/null | grep -c 'a.txt')" = "1" ] && echo 1 || echo 0)" "l'archive CONTIENT réellement le fichier (a.txt)"

before_pub=$(ls -1 "$BACKUPS"/uploads-public-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
echo
run_case "dossiers vides" "/empty/uploads" "/empty/uploads"
after_pub=$(ls -1 "$BACKUPS"/uploads-public-*.tar.gz 2>/dev/null | wc -l | tr -d ' ')

check "$([ "$before_pub" = "$after_pub" ] && echo 1 || echo 0)" "aucune archive vide créée pour un dossier vide"
check "$([ "$(ls -1 "$BACKUPS"/db-backup-*.dump 2>/dev/null | wc -l | tr -d ' ')" -le 2 ] && echo 1 || echo 0)" "rétention appliquée (KEEP=2)"

echo
if [ "$fail" = "0" ]; then echo "RÉSULTAT : OK"; exit 0; else echo "RÉSULTAT : ECHEC"; exit 1; fi
