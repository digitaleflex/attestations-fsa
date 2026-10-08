#!/usr/bin/env bash
# =================================================================
# Purge de rétention RGPD (cron FSA, #153)
# =================================================================
# Appelle POST /api/internal/retention/purge avec le secret CRON_SECRET.
# La route est idempotente : un double déclenchement (superposition de
# jobs, redéploiement) ne purge jamais deux fois la même ligne, et un
# passage sans rien à purger n'écrit aucune ligne d'audit.
#
# Usage :
#   CRON_SECRET=xxx APP_URL=https://exemple.com ./scripts/cron-retention-purge.sh
#
# Entrée crontab (quotidienne, 04:00 UTC — horaire distinct du monitoring
# backup de 05:00 UTC, sans lien avec lui : cf. docs/legal/retention-policy.md) :
#   0 4 * * * CRON_SECRET=xxx APP_URL=https://exemple.com \
#     /chemin/vers/attestations-fsa/scripts/cron-retention-purge.sh \
#     >> /var/log/fsa-cron-retention.log 2>&1
# =================================================================
set -euo pipefail

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
ENDPOINT="${APP_URL%/}/api/internal/retention/purge"
TIMEOUT="${CRON_TIMEOUT:-60}"

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
  echo "$(date -Is) [ERROR] appel purge-rétention en échec sur ${ENDPOINT}: ${response}" >&2
  exit 1
}

echo "$(date -Is) [OK] ${ENDPOINT} -> ${response}"
