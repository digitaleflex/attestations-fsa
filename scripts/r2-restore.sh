#!/usr/bin/env bash
# Restaurer un export R2 local. Par défaut, simulation seule : la production
# ne doit jamais être écrasée implicitement.
set -euo pipefail

: "${R2_SOURCE_DIR:?R2_SOURCE_DIR est requis (répertoire créé par r2-backup.sh)}"
: "${R2_BUCKET:?R2_BUCKET est requis}"
R2_PREFIX="${R2_PREFIX:-}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
R2_PROFILE="${R2_PROFILE:-default}"
APPLY="${APPLY:-false}"

[ -d "$R2_SOURCE_DIR" ] || { echo "ERROR: répertoire source absent: $R2_SOURCE_DIR" >&2; exit 1; }
[ -f "$R2_SOURCE_DIR/manifest.json" ] || { echo "ERROR: manifest.json absent" >&2; exit 1; }
command -v aws >/dev/null || { echo "ERROR: aws CLI absent" >&2; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq absent" >&2; exit 1; }
jq empty "$R2_SOURCE_DIR/manifest.json"

aws_args=(--profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --no-cli-pager)
destination="s3://${R2_BUCKET}/${R2_PREFIX#/}"
# Les métadonnées d'export ne sont pas des objets applicatifs : ni le manifeste
# courant ni les marqueurs horodatés `r2-export-*.manifest.json` ne doivent
#atterrir dans le bucket.
exclude_args=(--exclude "manifest.json" --exclude "r2-export-*.manifest.json")

# Le manifeste est contrôlé avant toute écriture. La taille de chaque objet est
# comparée au fichier local ; cela détecte une export incomplet sans exposer
# de données dans les logs.
jq -e 'type == "array" and all(.[]; (.Key | type == "string") and (.Size | type == "number"))' \
  "$R2_SOURCE_DIR/manifest.json" >/dev/null
prefix_filter="${R2_PREFIX%/}/"
[ -n "$R2_PREFIX" ] || prefix_filter=""
count=0
while IFS=$'\t' read -r key size; do
  file="$R2_SOURCE_DIR/${key#"$prefix_filter"}"
  [ -f "$file" ] || { echo "ERROR: objet absent de l'export: $key" >&2; exit 1; }
  actual=$(wc -c < "$file")
  [ "$actual" -eq "$size" ] || { echo "ERROR: taille inattendue pour $key" >&2; exit 1; }
  count=$((count + 1))
done < <(jq -r --arg prefix "$prefix_filter" 'if ($prefix | length) == 0 then .[] else (.[] | select(.Key | startswith($prefix))) end | [.Key, .Size] | @tsv' "$R2_SOURCE_DIR/manifest.json")

if [ "$APPLY" != "true" ]; then
  echo "==> DRY-RUN : $count objet(s) valide(s). Relancer avec APPLY=true pour écrire."
  aws s3 sync "${aws_args[@]}" "$R2_SOURCE_DIR" "$destination" "${exclude_args[@]}" --dryrun --only-show-errors
  exit 0
fi

echo "==> Restauration R2 : $count objet(s) vers $destination"
aws s3 sync "${aws_args[@]}" "$R2_SOURCE_DIR" "$destination" "${exclude_args[@]}" --only-show-errors
echo "==> Restauration terminée. Vérifier l'application et les URL signées avant de déclarer l'incident clos."
