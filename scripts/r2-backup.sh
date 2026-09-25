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
# La source S3 reste SÉPARÉE des options communes : la réutiliser pour
# `aws s3api` passait un argument positionnel `s3://bucket` à une commande
# qui n'en accepte pas, et le manifeste n'était jamais produit.
if [ -n "$R2_PREFIX" ]; then source_uri="s3://${R2_BUCKET}/${R2_PREFIX#/}"; else source_uri="s3://${R2_BUCKET}"; fi

command -v aws >/dev/null || { echo "ERROR: aws CLI absent" >&2; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq absent" >&2; exit 1; }
mkdir -p "$R2_BACKUP_DIR"
chmod 700 "$R2_BACKUP_DIR"

echo "==> Export R2 (${DRY_RUN}) : ${R2_BUCKET}/${R2_PREFIX} -> ${R2_BACKUP_DIR}"
aws s3 sync "${aws_args[@]}" "$source_uri" "$R2_BACKUP_DIR" --only-show-errors
if [ "$DRY_RUN" = "true" ]; then
  echo "==> Dry-run terminé ; aucun manifeste écrit."
  exit 0
fi

# L'inventaire est une aide de contrôle, pas une preuve de contenu à lui seul.
# Les octets restent dans les fichiers exportés et sont protégés par les
# permissions du répertoire.
#
# PAGINATION (#260) : `aws s3api list-objects-v2` ne pagine PAS tout seul
# (contrairement à `aws s3`), il renvoie une seule page (1 000 clés max). Sur un
# bucket de plus de 1 000 objets, l'ancien code produisait un manifeste
# SILENCIEUSEMENT TRONQUÉ — une sauvegarde qui « passe » alors qu'elle est
# incomplète. On suit donc `NextContinuationToken` jusqu'à la dernière page et
# on accumule les objets.
R2_MAX_PAGES="${R2_MAX_PAGES:-10000}"
R2_PREFIX_FILTER="${R2_PREFIX%/}"
manifest_tmp="$(mktemp "${TMPDIR:-/tmp}/r2-manifest.XXXXXX")"
trap 'rm -f "$manifest_tmp"' EXIT
printf '[' > "$manifest_tmp"
token=""
prev_token=""
page=0
first=1
while :; do
  page=$((page + 1))
  [ "$page" -le "$R2_MAX_PAGES" ] || {
    echo "ERROR: pagination list-objects-v2 non terminée après $R2_MAX_PAGES pages (bucket=$R2_BUCKET)" >&2
    exit 1
  }
  list_args=("${aws_args[@]}" --bucket "$R2_BUCKET")
  if [ -n "$R2_PREFIX_FILTER" ]; then list_args+=(--prefix "$R2_PREFIX_FILTER"); fi
  [ -n "$token" ] && list_args+=(--continuation-token "$token")
  page_json="$(aws s3api list-objects-v2 "${list_args[@]}" \
    --query '{Contents:Contents,Next:NextContinuationToken}' --output json)"
  page_items="$(jq --arg prefix "$R2_PREFIX_FILTER" '
    (.Contents // [])
    | map({Key: .Key, Size: .Size, ETag: .ETag, LastModified: .LastModified})
    | if ($prefix | length) > 0
      then map(select(.Key == $prefix or (.Key | startswith($prefix + "/"))))
      else . end
  ' <<<"$page_json")"
  items_count="$(jq 'length' <<<"$page_items")"
  if [ "$items_count" -gt 0 ]; then
    # `jq -c '.[]'` émet un objet par ligne : il faut recoller les lignes d'une
    # page par des virgules pour obtenir un tableau JSON valide.
    page_csv="$(jq -c '.[]' <<<"$page_items" | paste -sd, -)"
    if [ "$first" -eq 0 ]; then printf ',' >> "$manifest_tmp"; fi
    printf '%s' "$page_csv" >> "$manifest_tmp"
    first=0
  fi
  token="$(jq -r '.Next // ""' <<<"$page_json")"
  [ -n "$token" ] || break
  [ "$token" != "$prev_token" ] || { echo "ERROR: jeton de pagination répété" >&2; exit 1; }
  prev_token="$token"
done
printf ']\n' >> "$manifest_tmp"
jq '.' "$manifest_tmp" > "$R2_BACKUP_DIR/manifest.json"
rm -f "$manifest_tmp"
chmod 600 "$R2_BACKUP_DIR/manifest.json"
echo "==> Inventaire paginé : $(jq 'length' "$R2_BACKUP_DIR/manifest.json") objet(s) en $page page(s)"
# Marqueur stable pour le contrôle de fraîcheur et l'archivage des exports.
cp "$R2_BACKUP_DIR/manifest.json" "$R2_BACKUP_DIR/r2-export-$(date +%Y%m%d-%H%M%S).manifest.json"
echo "==> Manifeste écrit : $R2_BACKUP_DIR/manifest.json"
echo "==> Vérification manuelle recommandée : jq 'length' $R2_BACKUP_DIR/manifest.json"
