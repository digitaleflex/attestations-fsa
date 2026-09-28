#!/usr/bin/env bash
# Vérifier le versioning R2 et les invariants de configuration d'un bucket privé.
# Sortie 0 = OK ; sortie 2 = alerte à traiter. Aucune donnée bucket n'est écrite.
set -euo pipefail

: "${R2_BUCKET:?R2_BUCKET est requis}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
R2_PROFILE="${R2_PROFILE:-default}"
command -v aws >/dev/null || { echo "ERROR: aws CLI absent" >&2; exit 1; }

args=(--profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --no-cli-pager)
status="$(aws s3api get-bucket-versioning "${args[@]}" --bucket "$R2_BUCKET" --query Status --output text 2>&1)" || {
  echo "ALERTE: impossible de lire le versioning de $R2_BUCKET: $status" >&2
  exit 2
}
if [ "$status" != "Enabled" ]; then
  echo "ALERTE: versioning R2 désactivé pour $R2_BUCKET (statut=$status)." >&2
  echo "Action: activer avec aws s3api put-bucket-versioning --bucket '$R2_BUCKET' --versioning-configuration Status=Enabled" >&2
  exit 2
fi

echo "OK: versioning activé pour $R2_BUCKET."
echo "INFO: activer aussi une règle de rétention/ Lifecycle et surveiller les échecs de réplication hors site."
