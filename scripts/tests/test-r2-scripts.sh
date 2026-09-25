#!/usr/bin/env bash
# =================================================================
# Banc d'essai des scripts d'exploitation R2 (#260) — SANS AWS, SANS
# réseau, SANS credentials, SANS donnée réelle.
#
# Pourquoi : les scripts R2 ne sont pas couverts par vitest (ce sont des
# scripts bash) et les tester pour de vrai exigerait un bucket Cloudflare
# et des clés. Ici, `aws` est remplacé par un binaire FACTICE qui lit un
# répertoire temporaire comme s'il était un bucket. `jq` reste le vrai, il
# est présent partout où bash l'est. Les clés utilisées sont des
#lorem-ipsum, aucun fichier du dépôt n'est lu ni écrit.
#
# Usage :
#   bash scripts/tests/test-r2-scripts.sh
#
# Ce qu'il prouve :
#   - la pagination list-objects-v2 suit NextContinuationToken jusqu'au bout
#     (régression #260 : manifeste silencieusement tronqué > 1 000 objets) ;
#   - le filtre de préfixe n'inclut pas les clés « presque identiques » ;
#   - la restauration est un dry-run par défaut et refuse un export incomplet ;
#   - fraîcheur / versioning / alerte agrégée renvoient les bons codes de
#     sortie (0 = OK, 2 = alerte) ;
#   - aucun secret n'est écrit dans les logs pendant les contrôles.
# =================================================================
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
BIN="$WORK/bin"
BUCKET="$WORK/bucket"      # « bucket » R2 simulé
WRITES="$WORK/restored"    # ce qu'une restauration écrirait réellement
LOG="$WORK/aws-calls.log"
export BUCKET WRITES LOG
mkdir -p "$BIN" "$BUCKET" "$WRITES"

cleanup() { [ -n "${KEEP_WORK:-}" ] || rm -rf "$WORK"; }
trap cleanup EXIT

# --- aws factice ---------------------------------------------------------
# Comprend uniquement les sous-commandes utilisées par les scripts R2.
cat > "$BIN/aws" <<'STUB'
#!/usr/bin/env bash
# Journalise l'appel (sans jamais journaliser de credential : le script
# n'en accepte aucune en argument).
printf '%s\n' "$*" >> "$LOG"

fail() { echo "$1" >&2; exit 255; }

sub=""
for a in "$@"; do
  case "$a" in s3|s3api) sub="$a"; break ;; esac
done
[ -n "$sub" ] || exit 0

argval() { # nom, shift -> valeur
  local name="$1"; shift
  while [ $# -gt 0 ]; do
    if [ "$1" = "$name" ]; then printf '%s' "${2-}"; return 0; fi
    shift
  done
  printf ''
}

if [ "$sub" = "s3" ]; then
  shift                                    # sous-commande « s3 »
  [ "${1-}" = "sync" ] || exit 0
  shift                                    # sous-commande « sync »
  # Positionnels = arguments qui ne sont ni une option ni la valeur d'une option
  # (sinon le nom de profil se retrouve pris pour un chemin).
  positional=()
  skip=0
  for a in "$@"; do
    if [ "$skip" = "1" ]; then skip=0; continue; fi
    case " --profile --endpoint-url --region --exclude --storage-class --acl --cache-control " in
      *" $a "*) skip=1; continue ;;
    esac
    case "$a" in --*) continue ;; esac
    positional+=("$a")
  done
  src="${positional[0]:-}"; dst="${positional[1]:-}"
  [ -n "$src" ] && [ -n "$dst" ] || fail "sync: source/destination absentes"
  # Copie récursive. `--dryrun` (présent dans la ligne de commande) ET
  # FAKE_SYNC_DRYRUN signifient « ne rien écrire » — c'est ce que vérifie le
  # contrat de sécurité de r2-restore.sh.
  dryrun_flag=false
  for a in "$@"; do [ "$a" = "--dryrun" ] && dryrun_flag=true; done
  if [ "$dryrun_flag" = "true" ] || [ "${FAKE_SYNC_DRYRUN:-false}" = "true" ]; then exit 0; fi
  # « s3://<bucket>/<prefix> » => <racine factice>/<prefix>
  strip_bucket() { local u="${1#s3://}"; case "$u" in */*) printf '%s' "${u#*/}" ;; *) printf '' ;; esac; }
  case "$src" in
    s3://*)
      real_src="$BUCKET/$(strip_bucket "$src")"; real_dst="$dst" ;;
    *)
      real_src="$src"
      case "$dst" in s3://*) real_dst="$WRITES/$(strip_bucket "$dst")" ;; *) real_dst="$dst" ;; esac ;;
  esac
  [ -d "$real_src" ] || fail "sync: source inexistante: $src"
  mkdir -p "$real_dst"
  (cd "$real_src" && find . -type f -not -name 'manifest.json' -print0) |
    while IFS= read -r -d '' f; do
      mkdir -p "$real_dst/$(dirname "$f")"
      # Reproduit les exclusions aws sync --exclude (motifs simples).
      case "${f#./}" in
        manifest.json|r2-export-*.manifest.json) continue ;;
      esac
      cp "$real_src/$f" "$real_dst/$f"
    done
  exit 0
fi

# --- s3api ---------------------------------------------------------------
cmd="${2-}"
case "$cmd" in
  list-objects-v2)
    bucket="$(argval --bucket "${@:3}")"
    prefix="$(argval --prefix "${@:3}")"
    token="$(argval --continuation-token "${@:3}")"
    [ -n "$bucket" ] || fail "list-objects-v2: --bucket requis"
    keys=()
    while IFS= read -r f; do keys+=("${f#$BUCKET/}"); done < <(
      cd "$BUCKET" && find . -type f -printf '%P\n' | LC_ALL=C sort
    )
    if [ -n "$prefix" ]; then
      filtered=()
      for k in "${keys[@]}"; do
        [ "$k" = "$prefix" ] || case "$k" in "$prefix"/*) ;; *) continue ;; esac
        filtered+=("$k")
      done
      keys=("${filtered[@]}")
    fi
    start="${token:-0}"
    page="${FAKE_PAGE_SIZE:-1000}"
    total="${#keys[@]}"
    end=$((start + page))
    [ "$end" -le "$total" ] || end="$total"
    items=''
    comma=''
    i="$start"
    while [ "$i" -lt "$end" ]; do
      k="${keys[$i]}"
      size="$(wc -c < "$BUCKET/$k" | tr -d ' ')"
      items="$items${comma}{\"Key\":\"$k\",\"Size\":$size,\"ETag\":\"\\\"fake\\\"\",\"LastModified\":\"2026-01-01T00:00:00.000Z\"}"
      comma=','
      i=$((i + 1))
    done
    next=""
    [ "$end" -lt "$total" ] && next="$((end))"
    # Applique grossièrement la projection JMESPath demandée : les scripts
    # demandent `{Contents:Contents,Next:NextContinuationToken}`.
    query="$(argval --query "${@:3}")"
    next_field="NextContinuationToken"
    case "$query" in *'Next:NextContinuationToken'*) next_field="Next" ;; esac
    printf '{"Contents":[%s],"%s":%s}\n' "$items" "$next_field" \
      "$([ -n "$next" ] && printf '"%s"' "$next" || printf 'null')"
    exit 0
    ;;
  get-bucket-versioning)
    [ -n "${FAKE_VERSIONING:-}" ] || exit 0
    [ "${FAKE_VERSIONING_FAIL:-false}" = "true" ] && fail "AccessDenied: lecture impossible"
    printf '%s\n' "$FAKE_VERSIONING"
    exit 0
    ;;
esac
exit 0
STUB
chmod +x "$BIN/aws"

# --- helpers -------------------------------------------------------------
fail_count=0
check() { # attendu(0/1), libelle
  if [ "$1" = "1" ]; then
    echo "  OK    $2"
  else
    echo "  ECHEC $2"
    fail_count=1
  fi
}
ok() { [ "$1" -eq 0 ] && echo 1 || echo 0; }

# Env d'exploitation commun : aucun credential réel, profil factice.
base_env=(env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN
  -u AWS_PROFILE PATH="$BIN:$PATH" R2_PROFILE=fake R2_ACCOUNT_ID=000000000000
  R2_BUCKET=fake-bucket R2_ENDPOINT=http://127.0.0.1:1/fake)

# ------------------------------------------------------------------
echo "== CAS 1 : export R2 avec pagination (régression #260) =="
# 5 objets, pages de 2 => 3 pages : l'inventaire doit tout contenir.
mkdir -p "$BUCKET/cv" "$BUCKET/stages" "$BUCKET/attestations"
printf 'aaaa' > "$BUCKET/cv/a.pdf"
printf 'bbbb' > "$BUCKET/cv/b.pdf"
printf 'cccc' > "$BUCKET/cv/c.pdf"
printf 'dddd' > "$BUCKET/stages/d.pdf"
printf 'eeee' > "$BUCKET/attestations/e.pdf"
rm -f "$LOG"
R2_BACKUP_DIR="$WORK/export-1" FAKE_PAGE_SIZE=2 \
  "${base_env[@]}" bash "$REPO/scripts/r2-backup.sh" > "$WORK/backup1.log" 2>&1
status=$?
check "$(ok $status)" "r2-backup.sh se termine sans erreur (code $status)"
check "$([ "$(jq 'length' "$WORK/export-1/manifest.json")" = "5" ] && echo 1 || echo 0)" \
  "le manifeste contient les 5 objets malgré 3 pages"
check "$([ "$(grep -c 'list-objects-v2' "$LOG")" = "3" ] && echo 1 || echo 0)" \
  "3 appels list-objects-v2 (une par page)"
check "$(grep -q 'Inventaire paginé : 5 objet(s) en 3 page' "$WORK/backup1.log" && echo 1 || echo 0)" \
  "le journal annonce la pagination"
check "$([ "$(find "$WORK/export-1" -name 'r2-export-*.manifest.json' | wc -l | tr -d ' ')" = "1" ] && echo 1 || echo 0)" \
  "un marqueur d'archivage horodaté est écrit"
check "$([ -f "$WORK/export-1/cv/a.pdf" ] && [ "$(cat "$WORK/export-1/cv/a.pdf")" = "aaaa" ] && echo 1 || echo 0)" \
  "les octets sont réellement exportés"
check "$([ "$(stat -c %a "$WORK/export-1")" = "700" ] && echo 1 || echo 0)" "répertoire d'export en 700"
check "$([ "$(stat -c %a "$WORK/export-1/manifest.json")" = "600" ] && echo 1 || echo 0)" "manifeste en 600"
check "$(grep -qiE 'secret|token=|X-Amz-Signature' "$LOG" && echo 0 || echo 1)" "aucun secret dans le journal aws"

[ -n "${DEBUG_HARNESS:-}" ] && { echo "--- log apres CAS 1 :"; cat "$LOG"; }
# ------------------------------------------------------------------
echo "== CAS 2 : filtre de préfixe (pas de faux positif) =="
mkdir -p "$BUCKET/objects/nested" "$BUCKET/objectsX"
printf 'o1' > "$BUCKET/objects/a.pdf"
printf 'o2' > "$BUCKET/objects/nested/b.pdf"
printf 'o3' > "$BUCKET/objectsX/c.pdf"   # clé « presque » identique
R2_PREFIX=objects R2_BACKUP_DIR="$WORK/export-2" FAKE_PAGE_SIZE=1 \
  "${base_env[@]}" bash "$REPO/scripts/r2-backup.sh" > "$WORK/backup2.log" 2>&1
status=$?
keys="$(jq -r '.[].Key' "$WORK/export-2/manifest.json" 2>/dev/null | LC_ALL=C sort | tr '\n' ' ')"
check "$(ok $status)" "export préfixé sans erreur (code $status)"
check "$([ "$keys" = "objects/a.pdf objects/nested/b.pdf " ] && echo 1 || echo 0)" \
  "seules les clés du préfixe sont inventoriées (obtenu: '$keys')"
check "$(grep -q objectsX "$WORK/export-2/manifest.json" && echo 0 || echo 1)" \
  "la clé objectsX est exclue du manifeste"

# ------------------------------------------------------------------
echo "== CAS 3 : restauration — dry-run par défaut =="
rm -f "$LOG"
rm -rf "$WRITES"; mkdir -p "$WRITES"
DRY_SYNC=1 FAKE_SYNC_DRYRUN=true R2_SOURCE_DIR="$WORK/export-1" \
  "${base_env[@]}" bash "$REPO/scripts/r2-restore.sh" > "$WORK/restore-dry.log" 2>&1
status=$?
check "$(ok $status)" "r2-restore.sh se termine sans erreur en dry-run (code $status)"
check "$(grep -q 'DRY-RUN' "$WORK/restore-dry.log" && echo 1 || echo 0)" "la sortie annonce le dry-run"
check "$([ "$(find "$WRITES" -type f | wc -l | tr -d ' ')" = "0" ] && echo 1 || echo 0)" \
  "aucun octet écrit pendant le dry-run"

R2_SOURCE_DIR="$WORK/export-1" "${base_env[@]}" \
  bash "$REPO/scripts/r2-restore.sh" > "$WORK/restore-apply.log" 2>&1
status=$?
check "$(ok $status)" "restauration APPLY implicite refusée sans erreur"
check "$([ "$(find "$WRITES" -type f | wc -l | tr -d ' ')" = "0" ] && echo 1 || echo 0)" \
  "sans APPLY=true, rien n'est écrit (sécurité par défaut)"
check "$(grep -q 'APPLY=true' "$WORK/restore-apply.log" && echo 1 || echo 0)" \
  "le message rappelle le passage explicite par APPLY=true"

R2_SOURCE_DIR="$WORK/export-1" "${base_env[@]}" \
  bash -c 'APPLY=true exec bash "$0"' "$REPO/scripts/r2-restore.sh" > "$WORK/restore-apply2.log" 2>&1
status=$?
check "$(ok $status)" "restauration avec APPLY=true sans erreur (code $status)"
check "$([ "$(find "$WRITES" -type f | wc -l | tr -d ' ')" = "5" ] && echo 1 || echo 0)" \
  "les 5 objets sont réécrits par la restauration"
check "$([ ! -f "$WRITES/manifest.json" ] && echo 1 || echo 0)" "le manifeste n'est jamais envoyé dans le bucket"

# ------------------------------------------------------------------
echo "== CAS 4 : restauration — export incomplet refusé =="
cp -r "$WORK/export-1" "$WORK/export-broken"
printf 'corrompu' > "$WORK/export-broken/cv/a.pdf"      # taille incohérente
R2_SOURCE_DIR="$WORK/export-broken" "${base_env[@]}" \
  bash "$REPO/scripts/r2-restore.sh" > "$WORK/restore-broken.log" 2>&1
status=$?
check "$([ "$status" -eq 1 ] && echo 1 || echo 0)" "taille incohérente => exit 1 (code $status)"
check "$(grep -q 'taille inattendue' "$WORK/restore-broken.log" && echo 1 || echo 0)" \
  "le message nomme la taille inattendue (sans contenu de fichier)"

cp -r "$WORK/export-1" "$WORK/export-missing"
rm "$WORK/export-missing/stages/d.pdf"
R2_SOURCE_DIR="$WORK/export-missing" "${base_env[@]}" \
  bash "$REPO/scripts/r2-restore.sh" > "$WORK/restore-missing.log" 2>&1
status=$?
check "$([ "$status" -eq 1 ] && echo 1 || echo 0)" "objet absent de l'export => exit 1 (code $status)"

# ------------------------------------------------------------------
echo "== CAS 5 : fraîcheur de la sauvegarde =="
MAX_AGE_HOURS=30 BACKUP_DIR="$WORK/export-1" \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-backup-freshness.sh" > "$WORK/fresh-ok.log" 2>&1
status=$?
check "$(ok $status)" "sauvegarde récente => exit 0 (code $status)"
check "$(grep -q '^OK:' "$WORK/fresh-ok.log" && echo 1 || echo 0)" "la sortie commence par OK:"

cp -r "$WORK/export-1" "$WORK/export-old"
touch -d '48 hours ago' "$WORK/export-old"/r2-export-*.manifest.json
MAX_AGE_HOURS=30 BACKUP_DIR="$WORK/export-old" \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-backup-freshness.sh" > "$WORK/fresh-old.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "sauvegarde de 48 h => exit 2 (code $status)"
check "$(grep -q 'ALERTE: export R2 trop ancien' "$WORK/fresh-old.log" && echo 1 || echo 0)" \
  "le message d'alerte d'ancienneté est explicite"

mkdir -p "$WORK/export-empty"
MAX_AGE_HOURS=30 BACKUP_DIR="$WORK/export-empty" \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-backup-freshness.sh" > "$WORK/fresh-none.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "aucun export => exit 2 (code $status)"

MAX_AGE_HOURS=30 BACKUP_DIR="$WORK/nexistepas" \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-backup-freshness.sh" > "$WORK/fresh-dir.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "répertoire absent => exit 2 (code $status)"

MAX_AGE_HOURS=0 BACKUP_DIR="$WORK/export-1" \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-backup-freshness.sh" > "$WORK/fresh-arg.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "MAX_AGE_HOURS=0 invalide => exit 2 (code $status)"

# ------------------------------------------------------------------
echo "== CAS 6 : versioning du bucket =="
FAKE_VERSIONING=Enabled "${base_env[@]}" \
  bash "$REPO/scripts/check-r2-versioning.sh" > "$WORK/ver-ok.log" 2>&1
status=$?
check "$(ok $status)" "versioning activé => exit 0 (code $status)"
check "$(grep -q 'OK: versioning activé' "$WORK/ver-ok.log" && echo 1 || echo 0)" "confirmation OK en sortie"

FAKE_VERSIONING=Suspended "${base_env[@]}" \
  bash "$REPO/scripts/check-r2-versioning.sh" > "$WORK/ver-ko.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "versioning suspendu => exit 2 (code $status)"
check "$(grep -q 'put-bucket-versioning' "$WORK/ver-ko.log" && echo 1 || echo 0)" \
  "le message d'alerte indique la commande de remédiation"

FAKE_VERSIONING=Enabled FAKE_VERSIONING_FAIL=true "${base_env[@]}" \
  bash "$REPO/scripts/check-r2-versioning.sh" > "$WORK/ver-fail.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "bucket illisible => exit 2 (code $status)"

# ------------------------------------------------------------------
echo "== CAS 7 : alerte agrégée (freshness + versioning) =="
MAX_AGE_HOURS=30 BACKUP_DIR="$WORK/export-1" FAKE_VERSIONING=Enabled \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-alerts.sh" > "$WORK/alerts-ok.log" 2>&1
status=$?
check "$(ok $status)" "tous les contrôles OK => exit 0 (code $status)"

MAX_AGE_HOURS=30 BACKUP_DIR="$WORK/export-old" FAKE_VERSIONING=Suspended \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-alerts.sh" > "$WORK/alerts-ko.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "deux alertes => exit 2 (code $status)"
check "$([ "$(grep -c 'ALERTE' "$WORK/alerts-ko.log")" -ge 2 ] && echo 1 || echo 0)" \
  "les deux alertes (fraîcheur + versioning) sont relayées"
check "$(grep -qiE 'AWS_SECRET|aws_secret_access_key' "$WORK/alerts-ko.log" && echo 0 || echo 1)" \
  "l'alerte ne fuite aucun credential"

env -u R2_BUCKET BACKUP_DIR="$WORK/export-1" MAX_AGE_HOURS=30 \
  "${base_env[@]}" bash "$REPO/scripts/check-r2-alerts.sh" > "$WORK/alerts-nobucket.log" 2>&1
status=$?
check "$([ "$status" -eq 2 ] && echo 1 || echo 0)" "R2_BUCKET absent => exit 2 (contrôle non contourné)"

# ------------------------------------------------------------------
echo
echo "===================================================="
if [ "$fail_count" = "0" ]; then
  echo "RÉSULTAT : OK"
  echo "Aucun credential AWS, aucun accès réseau, aucune donnée réelle n'ont été requis."
  exit 0
fi
echo "RÉSULTAT : ECHEC"
exit 1
