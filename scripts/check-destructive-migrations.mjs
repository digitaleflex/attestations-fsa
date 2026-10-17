#!/usr/bin/env node
/**
 * Garde-fou : aucune migration DESTRUCTIVE ne part en production sans
 * décision explicite et tracée.
 *
 * ## Le problème
 *
 * `prisma migrate deploy` est exécuté par le pipeline sur la base de
 * production (`deploy.yml`, étape 2 du deploiement). Une migration qui
 * contient un `DROP COLUMN` / `DROP TABLE` / `TRUNCATE` y detruit des
 * donnees definitivement : il n'y a pas de "retour arriere" de migration,
 * Prisma n'enregistre que le sens direct.
 *
 * Le filet existant (`vps-pre-deploy-backup.sh`) sauvegarde la base AVANT
 * la migration, mais restaurer une base de production est une operation
 * delicate qui revoque l'acces a la donnee fraichement ecrite pendant la
 * fenetre d'indisponibilite. Mieux vaut interdire la migration destructrice
 * en amont que choisir un jour de bravoure pour restaurer un dump.
 *
 * Ce controle est 100 % STATIQUE : il lit des fichiers .sql et n'ouvre
 * aucune connexion. Il ne peut donc pas affecter la production, ce qui est
 * la raison de le preferer a une strategie de rollback automatique.
 *
 * ## Le perimetre
 *
 * L'historique contient des migrations destructives DEJA APPLIQUEES
 * (voir `.destructive-baseline.json`). Elles sont reconnues et ignorées :
 * le garde-fou porte sur l'AVENIR, il ne sert pas a rejouer le passe.
 *
 * ## Sortie
 *
 *  0 : aucune nouvelle migration destructive
 *  1 : au moins une, avec le détail des instructions pour la traiter
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");
const BASELINE_FILE = join(MIGRATIONS_DIR, ".destructive-baseline.json");

/**
 * Motifs destructifs, avec le raisonnement de chacun.
 *
 * `RENAMING_OPERATION` / `SET_NOT_NULL` sont volontairement absents : ils ne
 * perdent pas de donnees. `DELETE FROM` n'est pas liste : un DELETE avec
 * clause WHERE est un choix metier legitime et hors perimetre de ce garde.
 */
const DESTRUCTIVE = [
  {
    pattern: /\bDROP\s+TABLE\b/i,
    label: "DROP TABLE",
    why: "supprime definitivement la table et toutes ses lignes",
  },
  {
    pattern: /\bDROP\s+SCHEMA\b/i,
    label: "DROP SCHEMA",
    why: "supprime tout un schema",
  },
  {
    pattern: /\bDROP\s+DATABASE\b/i,
    label: "DROP DATABASE",
    why: "supprime la base",
  },
  {
    pattern: /\bDROP\s+COLUMN\b/i,
    label: "DROP COLUMN",
    why: "supprime la colonne et ses donnees",
  },
  {
    pattern: /\bTRUNCATE\b/i,
    label: "TRUNCATE",
    why: "vide la table (plus rapide que DELETE, irreversible sans restore)",
  },
];

/** Charge le referentiel des migrations destructives deja acceptees. */
function loadBaseline() {
  if (!existsSync(BASELINE_FILE)) return { accepted: {} };
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  } catch (error) {
    console.error(
      `ERREUR : ${BASELINE_FILE} est invalide (${error.message}).`,
    );
    console.error("Corrige le JSON : une baseline illisible ne peut rien autoriser.");
    process.exit(1);
  }
}

function main() {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.error(`ERREUR : ${MIGRATIONS_DIR} introuvable.`);
    process.exit(1);
  }

  const { accepted = {} } = loadBaseline();

  const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const offenders = [];

  for (const name of entries) {
    const sqlPath = join(MIGRATIONS_DIR, name, "migration.sql");
    if (!existsSync(sqlPath)) continue;

    const sql = readFileSync(sqlPath, "utf8");

    // Ignore les commentaires SQL : une migration qui *parle* d'un DROP
    // n'en execute aucun.
    const code = sql
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const found = DESTRUCTIVE.filter((d) => d.pattern.test(code)).map((d) => ({
      ...d,
      occurrences: (code.match(new RegExp(d.pattern.source, "gi")) || []).length,
    }));

    if (found.length === 0) continue;

    if (accepted[name]) {
      console.log(`  historique  ${name} — ${found.map((f) => f.label).join(", ")}`);
      continue;
    }

    offenders.push({ name, found });
  }

  if (offenders.length === 0) {
    console.log(
      `OK : ${entries.length} migrations, aucune nouvelle migration destructive.`,
    );
    return;
  }

  console.error("");
  console.error("ECHEC : nouvelle(s) migration(s) destructive(s) non autorisee(s).");
  console.error("");
  for (const { name, found } of offenders) {
    console.error(`  ${name}`);
    for (const f of found) {
      console.error(`      ${f.label} x${f.occurrences} — ${f.why}`);
    }
  }
  console.error("");
  console.error("Choisis UNE des trois options :");
  console.error("");
  console.error("  1. Si la migration SUPPRIME REELLEMENT des donnees qui doivent");
  console.error("     survivre : ne la fusionne pas. Demande une validation.");
  console.error("");
  console.error("  2. Si la suppression est voulue et sans perte utile (colonne");
  console.error("     obsolete, table vide, champ deja vide en base) : declare-la");
  console.error(`     dans ${BASELINE_FILE.replace(process.cwd() + "/", "")}`);
  console.error("     avec une justification, puis relance le controle.");
  console.error("");
  console.error("  3. Si la migration peut etre ADAPTEE pour ne rien perdre :");
  console.error("     Prisma exige 3 etapes pour renommer sans perte");
  console.error("     (add nullable -> backfill -> set NOT NULL + drop).");
  console.error("");
  console.error("  Rappel : `prisma migrate deploy` n'a pas de rollback. Une migration");
  console.error("  destructive appliquee en production est irreversible sans");
  console.error("  restauration d'un dump — donc autant l'attraper avant.");
  process.exit(1);
}

main();