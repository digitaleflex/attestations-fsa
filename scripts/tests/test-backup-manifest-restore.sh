#!/usr/bin/env bash
# =================================================================
# Banc d'essai de scripts/backup-manifest.sh et
# scripts/verify-backup-restore.sh — SANS base de données, SANS Docker.
#
# Une procédure de restauration qui ne peut être testée que sur la production
# n'est pas une procédure, c'est une espérance. Ici on rejoue le flux complet
# sur des fichiers temporaires :
#   1. construction du manifeste à partir d'une sauvegarde factice ;
#   2. vérification d'une sauvegarde INTÈGRE (sortie 0) ;
#   3. vérification d'une sauvegarde ALTÉRÉE après coup (sortie 2, refus) ;
#   4. restauration refusée vers une cible de PRODUCTION (sortie 2, refus) ;
#   5. restauration acceptée vers une base isolée locale (plan + aucun dump
#      réellement restauré : ce banc ne touche à aucune base).
#
# Usage :
#   bash scripts/tests/test-backup-manifest-restore.sh
# =================================================================
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
SAVE="$WORK/sauvegarde"
OUT="$WORK/rapports"
TS="20260925-030000"
mkdir -p "$SAVE" "$OUT"

# Sauvegarde factice : un dump de base et une archive de volume uploads.
printf 'PGDUMP-FACTICE' > "$SAVE/db-backup-$TS.dump"
tar czf "$SAVE/uploads-public-$TS.tar.gz" -C "$WORK" . 2>/dev/null

run_manifest() { # chemin du manifeste
  pnpm exec ts-node --project tsconfig.seed.json scripts/backup-manifest.ts \
    --dir "$SAVE" --out "$1" --backup-id "db-backup-$TS" 2>&1 | sed 's/^/     /'
  return "${PIPESTATUS[0]}"
}

run_restore() { # manifeste, base, hôte
  pnpm exec ts-node --project tsconfig.seed.json scripts/verify-backup-restore.ts \
    --manifest "$1" --dir "$SAVE" --host "$3" --database "$2" --plan "$OUT/plan.json" 2>&1 | sed 's/^/     /'
  return "${PIPESTATUS[0]}"
}

fail=0
check() { if [ "$1" = "0" ]; then echo "  OK   $2"; else echo "  ECHEC $2"; fail=1; fi }

echo "Banc d'essai — manifeste + restauration (local, sans base)"
echo "======================================================"

echo
echo "== CAS 1 : sauvegarde intègre"
run_manifest "$OUT/manifest.json" >/dev/null
check "$?" "le manifeste est construit"
[ -s "$OUT/manifest.json" ]
check "$?" "le manifeste est écrit sur disque"
grep -q '"digest"' "$OUT/manifest.json"
check "$?" "le manifeste porte une empreinte"
grep -q '"volumes"' "$OUT/manifest.json"
check "$?" "le manifeste indique le volume couvert"
grep -q '2026-' "$OUT/manifest.json"
check "$?" "le manifeste porte une date"
! grep -q '/tmp/' "$OUT/manifest.json"
check "$?" "aucun chemin absolu dans le manifeste"

run_restore "$OUT/manifest.json" "fsa_restore_20260925" "localhost"
check "$?" "la restauration d'une sauvegarde intègre est acceptée"
[ -s "$OUT/plan.json" ]
check "$?" "un plan de restauration est produit"
grep -q 'pg_restore' "$OUT/plan.json"
check "$?" "le plan contient les commandes de restauration"

echo
echo "== CAS 2 : sauvegarde altérée APRÈS le manifeste"
printf 'PGDUMP-MODIFIE' > "$SAVE/db-backup-$TS.dump"
run_restore "$OUT/manifest.json" "fsa_restore_20260925" "localhost" >/dev/null
[ "$?" = "2" ]
check "$?" "l'altération est refusée (code 2)"
printf 'PGDUMP-FACTICE' > "$SAVE/db-backup-$TS.dump"

echo
echo "== CAS 3 : cible de production"
run_restore "$OUT/manifest.json" "attestation_fsa" "db.production.internal" >/dev/null
[ "$?" = "2" ]
check "$?" "une cible non isolée est refusée (code 2)"

echo
echo "== CAS 4 : manifeste altéré (champ dérivé retouché)"
sed 's/"totalBytes": [0-9]*/"totalBytes": 1/' "$OUT/manifest.json" > "$OUT/manifest-altere.json"
run_restore "$OUT/manifest-altere.json" "fsa_restore_20260925" "localhost" >/dev/null
[ "$?" = "1" ]
check "$?" "un manifeste incohérent est rejeté"

echo
rm -rf "$WORK"
if [ "$fail" = "0" ]; then echo "RÉSULTAT : OK"; exit 0; else echo "RÉSULTAT : ECHEC"; exit 1; fi
