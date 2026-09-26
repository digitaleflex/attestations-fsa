#!/usr/bin/env bash
# =================================================================
# Ouverture automatique des examens planifiés (cron FSA)
# =================================================================
# Appelle POST /api/internal/exams/open avec le secret CRON_SECRET.
# La route est idempotente : un double déclenchement (superposition de
# jobs, redéploiement) n'ouvre jamais deux fois le même examen.
#
# Usage :
#   CRON_SECRET=xxx APP_URL=https://exemple.com ./scripts/cron-open-exams.sh
#
# Entrée crontab (toutes les 5 minutes) :
#   */5 * * * * CRON_SECRET=xxx APP_URL=https://exemple.com \
#     /chemin/vers/attestations-fsa/scripts/cron-open-exams.sh \
#     >> /var/log/fsa-cron-open.log 2>&1
#
# Docker (compose.prod.yml, service `exam-cron`) : le service appelle
# ce même endpoint toutes les 5 minutes via le réseau backend.
# =================================================================
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
ENDPOINT="${APP_URL%/}/api/internal/exams/open"
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
  echo "$(date -Is) [ERROR] appel cron en échec sur ${ENDPOINT}: ${response}" >&2
  exit 1
}

echo "$(date -Is) [OK] ${ENDPOINT} -> ${response}"
