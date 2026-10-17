#!/usr/bin/env bash
# Exercice de restauration RÉEL — preuve que la sauvegarde est restaurable.
#
# `scripts/verify-backup-restore.ts` produit un PLAN et n'exécute rien, par
# précaution. Ce script, lui, EXÉCUTE — mais uniquement dans une base jetable
# qu'il crée et supprime lui-même. Il ne touche jamais la production.
#
# ## Ce que le plan ne prouvait pas
#
# Un plan de restauration peut être parfait et le backup inutilisable : dump
# tronqué, index corrompu, données à moitié revenues. Tant que personne n'a
# restauré pour de vrai, le filet de sécurité est une hypothèse, pas un fait.
#
# ## Ce que ce script prouve
#
#   1. pg_restore lit réellement l'archive (le plan ne le fait pas)
#   2. La base restaurée a le MÊME nombre de lignes que la source, table par
#      table — pas seulement « la commande a réussi »
#   3. Les contraintes d'intégrité sont satisfaites après restauration
#      (pg_restore les vérifie : c'est la preuve que rien n'est incohérent)
#
# ## Sécurité
#
# - Base cible nommée `fsa_restore_drill_<timestamp>` : le préfixe imposé par
#   lib/backup/restore.ts (ISOLATED_DATABASE_PATTERN).
# - Connexion en TCP local, utilisateur postgres du conteneur de test.
# - La base est DROPPÉE à la fin, même en cas d'échec (trap).
# - Aucune donnée réelle n'est requise : le script crée sa propre source.
#
# Usage :
#   scripts/restore-drill.sh                    # base jetable complète
#   RESTORE_DRILL_DUMP=chemin/x.dump scripts/restore-drill.sh   # dump existant
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-fsa-restore-drill-pg}"
PG_PORT="${PG_PORT:-55432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-drill}"
DB_SOURCE="fsa_drill_source"
TS="$(date +%s)"
DB_TARGET="fsa_restore_drill_${TS}"
# Les dumps de l'exercice sont jetables : répertoire temporaire par défaut,
# jamais le répertoire de sauvegarde de production.
BACKUP_DIR="${BACKUP_DIR:-$(mktemp -d -t fsa-restore-drill-XXXXXX)}"

cleanup() {
  local code=$?
  echo ""
  echo "==> Nettoyage des bases jetables"
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_TARGET};" >/dev/null 2>&1 || true
  docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS fsa_restore_drill_neg_${TS};" >/dev/null 2>&1 || true
  docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
  return $code
}
trap cleanup EXIT

psql_target() { docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$1" -tAc "$2"; }

echo "==> Démarrage d'un PostgreSQL jetable (conteneur ${PG_CONTAINER})"
docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$PG_CONTAINER" \
  -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -e POSTGRES_USER="$PG_USER" \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null \
  || { echo "ERREUR : PostgreSQL jetable injoignable"; exit 1; }

echo "==> Création de la base source ${DB_SOURCE} avec le schéma réel de l'application"
# Le schéma vient du dépôt : on restaure le produit tel qu'il est en prod.
docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "CREATE DATABASE ${DB_SOURCE};" >/dev/null

# Le schéma Prisma contient du SQL pur : on le convertit via le générateur
# Prisma, sans toucher à la base de l'application.
SCHEMA_SQL="$(cd "$(dirname "$0")/.." && npx prisma migrate diff \
  --from-empty --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null)"
[ -n "$SCHEMA_SQL" ] || { echo "ERREUR : schéma Prisma non convertible en SQL"; exit 1; }
printf '%s\n' "$SCHEMA_SQL" | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$DB_SOURCE" -q >/dev/null

# Données de volume : on remplit TOUTES les tables métier avec des lignes
# identifiables, pour qu'une restauration partielle soit détectable.
echo "==> Injection de données de contrôle"
# Les colonnes sont celles du schéma RÉEL : l'exercice échoue volontairement si
# le produit change, plutôt que de valider un jeu de données fictif.
docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$DB_SOURCE" -q <<'SQL' >/dev/null
INSERT INTO "Formation" (id, name, category, skills, "createdAt")
  VALUES ('f-formation', 'Pisciculture', 'Aquaculture', '{}', now());
INSERT INTO "User" (id, name, email, role, "createdAt", "updatedAt")
  SELECT 'u' || g, 'Candidat ' || g, 'candidat' || g || '@drill.test', 'user', now(), now()
  FROM generate_series(1, 500) g;
INSERT INTO "Attestation" (id, "userId", code, "fullName", "birthDate", "birthPlace",
                           "formationId", "startDate", "endDate", location, instructor,
                           "issuingCompany", type, status)
  SELECT 'a' || g, 'u' || g, 'CODE-' || g, 'Candidat ' || g, '2000-01-01', 'Porto-Novo',
         'f-formation', '2026-01-01', '2026-06-30', 'Cité St André', 'Dr. Drill',
         'FSA', 'FORMATION', 'VALIDATED'
  FROM generate_series(1, 500) g;
INSERT INTO "StoredObject" (id, key, purpose, checksum, "createdAt", "updatedAt")
  SELECT 'o' || g, 'cv/user-' || g || '.pdf', 'CV', repeat('a', 64), now(), now()
  FROM generate_series(1, 200) g;
INSERT INTO "AuditLog" (id, "userId", action, resource, "resourceId", timestamp)
  SELECT 'l' || g, 'u1', 'TEST', 'DRILL', 'drill-' || g, now()
  FROM generate_series(1, 300) g;
SQL

# Le seed doit avoir pris en entier : sinon on comparerait deux bases vides
# et l'exercice passerait au vert sans rien prouver.
declare -A EXPECTED_ROWS=([User]=500 [Attestation]=500 [StoredObject]=200 [AuditLog]=300)
for table in "${!EXPECTED_ROWS[@]}"; do
  n="$(psql_target "$DB_SOURCE" "SELECT count(*) FROM \"${table}\";")"
  if [ "$n" -lt "${EXPECTED_ROWS[$table]}" ]; then
    echo "ERREUR : seed incomplet — ${table} a ${n} ligne(s), ${EXPECTED_ROWS[$table]} attendues."
    echo "         La comparaison qui suit ne prouverait rien : on compare deux bases vides."
    exit 1
  fi
done
echo "    Seed vérifié (500 utilisateurs, 500 attestations, 200 objets, 300 logs)"

SOURCE_ROWS="$(psql_target "$DB_SOURCE" "
  SELECT string_agg(t || '=' || c, ',' ORDER BY t) FROM (
    SELECT 'User' t, count(*) c FROM \"User\"
    UNION ALL SELECT 'Attestation', count(*) FROM \"Attestation\"
    UNION ALL SELECT 'StoredObject', count(*) FROM \"StoredObject\"
    UNION ALL SELECT 'AuditLog', count(*) FROM \"AuditLog\"
  ) s;")"
echo "    Source : ${SOURCE_ROWS}"

echo "==> pg_dump de la source"
DUMP="$BACKUP_DIR/db-drill-${TS}.dump"
mkdir -p "$BACKUP_DIR"
docker exec "$PG_CONTAINER" pg_dump -Fc -U "$PG_USER" -d "$DB_SOURCE" > "$DUMP"
[ -s "$DUMP" ] || { echo "ERREUR : dump vide"; exit 1; }
echo "    $(wc -c < "$DUMP") octets -> ${DUMP}"

echo "==> Création de la base cible isolée ${DB_TARGET}"
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "CREATE DATABASE ${DB_TARGET};" >/dev/null

echo "==> pg_restore réel (c'est ici que le plan s'arrêtait)"
# pg_restore doit LIRE le dump, donc il doit être dans le conteneur : le
# fichier produit par `docker exec … > fichier` est sur l'HÔTE et invisible du
# conteneur. On le copie avant de restaurer.
DUMP_IN_CONTAINER="/tmp/$(basename "$DUMP")"
docker cp "$DUMP" "$PG_CONTAINER:$DUMP_IN_CONTAINER" >/dev/null
# pg_restore valide les contraintes : une ligne manquante ou une FK cassée
# fait échouer la restauration. C'est la preuve d'intégrité.
docker exec "$PG_CONTAINER" pg_restore \
  -U "$PG_USER" -d "$DB_TARGET" \
  --exit-on-error --single-transaction "$DUMP_IN_CONTAINER"

echo "==> Comparaison table par table"
TARGET_ROWS="$(psql_target "$DB_TARGET" "
  SELECT string_agg(t || '=' || c, ',' ORDER BY t) FROM (
    SELECT 'User' t, count(*) c FROM \"User\"
    UNION ALL SELECT 'Attestation', count(*) FROM \"Attestation\"
    UNION ALL SELECT 'StoredObject', count(*) FROM \"StoredObject\"
    UNION ALL SELECT 'AuditLog', count(*) FROM \"AuditLog\"
  ) s;")"
echo "    Cible  : ${TARGET_ROWS}"

if [ "$SOURCE_ROWS" != "$TARGET_ROWS" ]; then
  echo ""
  echo "❌ ÉCHEC DE L'EXERCICE — la restauration n'est PAS fidèle"
  echo "   source: ${SOURCE_ROWS}"
  echo "   cible : ${TARGET_ROWS}"
  exit 1
fi

echo "==> Vérification du contenu (pas seulement du nombre de lignes)"
# Une restauration peut ramener le bon NOMBRE de lignes avec le mauvais
# contenu. On compare une empreinte de données réelles.
SRC_DIGEST="$(psql_target "$DB_SOURCE" "SELECT md5(string_agg(email, '|' ORDER BY email)) FROM \"User\";")"
TGT_DIGEST="$(psql_target "$DB_TARGET" "SELECT md5(string_agg(email, '|' ORDER BY email)) FROM \"User\";")"
if [ "$SRC_DIGEST" != "$TGT_DIGEST" ]; then
  echo "❌ ÉCHEC : contenu des utilisateurs différent (${SRC_DIGEST} vs ${TGT_DIGEST})"
  exit 1
fi
echo "    Empreinte des 500 e-mails identique : ${TGT_DIGEST}"

echo ""
echo "✅ EXERCICE DE RESTAURATION RÉUSSI"
echo "   La sauvegarde est restaurable et fidèle — le filet est réel, pas théorique."

# ─────────────────────────────────────────────────────────────────────────
# Négatif : le meme exercice doit ÉCHOUER sur un dump corrompu.
# Un test de restauration qui ne sait pas detecter la corruption ne prouve
# rien — c'est la raison d'etre de cette section.
# ─────────────────────────────────────────────────────────────────────────
echo ""
echo "==> NÉGATIF : un dump tronqué doit être détecté, pas restauré"
TRUNCATED="$BACKUP_DIR/db-drill-truncated-${TS}.dump"
head -c 1200 "$DUMP" > "$TRUNCATED"
[ -s "$TRUNCATED" ] || { echo "ERREUR : le fichier tronqué est vide"; exit 1; }
echo "    Dump tronqué : $(wc -c < "$TRUNCATED") octets (non vide — passe le test -s)"

docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "CREATE DATABASE fsa_restore_drill_neg_${TS};" >/dev/null

docker cp "$TRUNCATED" "$PG_CONTAINER:/tmp/truncated.dump" >/dev/null
if docker exec "$PG_CONTAINER" pg_restore -U "$PG_USER" \
     -d "fsa_restore_drill_neg_${TS}" \
     --exit-on-error --single-transaction /tmp/truncated.dump >/dev/null 2>&1; then
  echo ""
  echo "❌ ÉCHEC DE L'EXERCICE — un dump tronqué a été restauré sans erreur."
  echo "   C'est exactement le trou que la restaurabilité doit fermer :"
  echo "   un backup tronqué est NON VIDE, il passe les contrôles de taille,"
  echo "   et ne se révèle inutilisable que le jour de la restauration."
  exit 1
fi
echo "    ✅ pg_restore a bien refusé le dump tronqué (comme attendu)"

docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS fsa_restore_drill_neg_${TS};" >/dev/null 2>&1 || true

echo ""
echo "✅ EXERCICE COMPLET — restauration fidèle ET corruption détectée."