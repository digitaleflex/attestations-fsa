#!/usr/bin/env bash
# Exporter le bucket R2 vers un répertoire local, sans modifier le bucket source.
# Prérequis : aws cli v2 + jq, et des credentials AWS dans l'environnement ou
# un profile AWS. Ne jamais passer les clés sur la ligne de commande.
set -euo pipefail

: "${R2_BUCKET:?R2_BUCKET est requis}"
: "${R2_BACKUP_DIR:?R2_BACKUP_DIR est requis}"
R2_BACKUP_DIR="${R2_BACKUP_DIR%/}"
R2_PREFIX="${R2_PREFIX:-}"
R2_ENDPOINT="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"
R2_PROFILE="${R2_PROFILE:-default}"
DRY_RUN="${DRY_RUN:-false}"

aws_args=(--profile "$R2_PROFILE" --endpoint-url "$R2_ENDPOINT" --no-cli-pager)
if [ "$DRY_RUN" = "true" ]; then aws_args+=(--dryrun); fi
if [ -n "$R2_PREFIX" ]; then aws_args+=("s3://${R2_BUCKET}/${R2_PREFIX#/}"); else aws_args+=("s3://${R2_BUCKET}"); fi

command -v aws >/dev/null || { echo "ERROR: aws CLI absent" >&2; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq absent" >&2; exit 1; }
mkdir -p "$R2_BACKUP_DIR"
chmod 700 "$R2_BACKUP_DIR"

echo "==> Export R2 (${DRY_RUN}) : ${R2_BUCKET}/${R2_PREFIX} -> ${R2_BACKUP_DIR}"
aws s3 sync "${aws_args[@]}" "$R2_BACKUP_DIR" --only-show-errors
if [ "$DRY_RUN" = "true" ]; then
  echo "==> Dry-run terminé ; aucun manifeste écrit."
  exit 0
fi

# L'inventaire est une aide de contrôle, pas une preuve de contenu à lui seul.
# Les octets restent dans les fichiers exportés et sont protégés par les
# permissions du répertoire.
aws s3api list-objects-v2 "${aws_args[@]}" --bucket "$R2_BUCKET" \
  --query 'Contents[].{Key:Key,Size:Size,ETag:ETag,LastModified:LastModified}' \
  --output json | jq --arg prefix "$R2_PREFIX" '
    if ($prefix | length) > 0 then map(select(.Key | startswith($prefix))) else . end
  ' > "$R2_BACKUP_DIR/manifest.json"
chmod 600 "$R2_BACKUP_DIR/manifest.json"
# Marqueur stable pour le contrôle de fraîcheur et l'archivage des exports.
cp "$R2_BACKUP_DIR/manifest.json" "$R2_BACKUP_DIR/r2-export-$(date +%Y%m%d-%H%M%S).manifest.json"
echo "==> Manifeste écrit : $R2_BACKUP_DIR/manifest.json"
echo "==> Vérification manuelle recommandée : jq 'length' $R2_BACKUP_DIR/manifest.json"
