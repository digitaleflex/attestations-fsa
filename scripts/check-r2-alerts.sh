#!/usr/bin/env bash
# Point d'entrée unique d'alerte R2 (#260) : fraîcheur de la sauvegarde locale +
# versioning du bucket. Destiné au cron / superviseur.
#
# Contrat de sortie (stable, à brancher tel quel sur une supervision) :
#   0 = tous les contrôles sont OK
#   2 = au moins un contrôle est en ALERTE (sauvegarde absente/ancienne,
#       versioning désactivé ou bucket illisible)
#   1 = erreur d'exécution (script manquant, prérequis absent)
#
# Aucun secret n'est imprimé : seuls les messages des contrôles sont relayés.
# ALERT_WEBHOOK, si défini, reçoit un POST JSON texte (best effort, non bloquant).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRESHNESS_SCRIPT="${FRESHNESS_SCRIPT:-$REPO_ROOT/scripts/check-r2-backup-freshness.sh}"
VERSIONING_SCRIPT="${VERSIONING_SCRIPT:-$REPO_ROOT/scripts/check-r2-versioning.sh}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

command -v curl >/dev/null || { echo "ERROR: curl absent" >&2; exit 1; }

failed=0
report=()

run_check() { # libelle, script
  local label="$1" script="$2"
  local out status
  if [ ! -f "$script" ]; then
    echo "ERROR: contrôle absent: $script" >&2
    exit 1
  fi
  out="$(bash "$script" 2>&1)"
  status=$?
  while IFS= read -r line; do [ -n "$line" ] && report+=("$label: $line"); done <<<"$out"
  if [ "$status" -ne 0 ]; then
    failed=1
    report+=("$label: ALERTE (code $status)")
  fi
  return 0
}

run_check "FRAICHEUR" "$FRESHNESS_SCRIPT"
if [ -n "${R2_BUCKET:-}" ]; then
  run_check "VERSIONING" "$VERSIONING_SCRIPT"
else
  report+=("VERSIONING: contrôle ignoré (R2_BUCKET non défini)")
  failed=1
fi

for line in "${report[@]}"; do echo "$line"; done

if [ "$failed" -ne 0 ]; then
  if [ -n "$ALERT_WEBHOOK" ]; then
    payload="R2 FSA: ALERTE — $(printf '%s' "${report[*]}" | tr -d '\n' | cut -c1-500)"
    curl --max-time 10 -fsS -X POST -H 'Content-Type: text/plain' \
      --data "$payload" "$ALERT_WEBHOOK" >/dev/null 2>&1 ||
      echo "WARN: emission de l'alerte impossible (webhook)" >&2
  fi
  exit 2
fi
exit 0
