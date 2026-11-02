#!/usr/bin/env bash
# =================================================================
# Expiration automatique des sessions d'examen (cron FSA)
# =================================================================
# Appelle POST /api/internal/exams/expire avec le secret CRON_SECRET.
# La route est idempotente : un double déclenchement (superposition de
# jobs, redéploiement) n'expire jamais deux fois la même session.
#
# Usage :
#   CRON_SECRET=xxx APP_URL=https://exemple.com ./scripts/cron-expire-sessions.sh
#
# Entrée crontab (toutes les 5 minutes, aligné sur le cron d'ouverture) :
#   */5 * * * * CRON_SECRET=xxx APP_URL=https://exemple.com \
#     /chemin/vers/attestations-fsa/scripts/cron-expire-sessions.sh \
#     >> /var/log/fsa-cron-expire.log 2>&1
#
# Docker (compose.prod.yml, service `exam-expire-cron`) : le service appelle
# ce même endpoint toutes les 5 minutes via le réseau backend.
# =================================================================
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
ENDPOINT="${APP_URL%/}/api/internal/exams/expire"
TIMEOUT="${CRON_TIMEOUT:-20}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "$(date -Is) [ERROR] CRON_SECRET absent — appel annulé" >&2
  exit 1
fi

# Le secret ne doit jamais apparaître dans les logs ni dans la sortie de curl.
response="$(
  curl --silent --show-error --fail-with-body \
    --max-time "$TIMEOUT" \
    --request POST \
    --header "Authorization: Bearer ${CRON_SECRET}" \
    --header "Content-Type: application/json" \
    --header "Accept: application/json" \
    --data '{}' \
    "$ENDPOINT" 2>&1
)" || {
  echo "$(date -Is) [ERROR] appel cron expiration en échec sur ${ENDPOINT}: ${response}" >&2
  exit 1
}

echo "$(date -Is) [OK] ${ENDPOINT} -> ${response}"