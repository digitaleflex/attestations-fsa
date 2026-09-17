/**
 * Garde-fou `tsconfig.json` pour un run E2E (issue #139).
 *
 * `next dev` réécrit `tsconfig.json` à son démarrage : il reformate le JSON et
 * y ajoute les chemins de types de son `distDir`
 * (`<distDir>/types/**\/*.ts`, `<distDir>/dev/types/**\/*.ts`). Comme la suite
 * E2E impose `NEXT_DIST_DIR=.next-e2e`, chaque run laissait l'arbre de travail
 * *dirty* sur un fichier suivi, sans aucune modification réelle.
 *
 * Contrainte d'ordonnancement Playwright (vérifiée sur la 1.63) : le
 * `webServer` est démarré par la phase « plugin setup », qui s'exécute AVANT
 * `globalSetup`. Un instantané pris dans `globalSetup` serait donc déjà pollué.
 * On capture donc l'état initial au CHARGEMENT de `playwright.config.ts` —
 * première évaluation du module, avant tout démarrage de serveur — et on le
 * restaure depuis `globalTeardown`, après l'arrêt du serveur.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * `distDir` dédié aux tests E2E. Source unique de vérité, partagée avec
 * `playwright.config.ts` (`NEXT_DIST_DIR`) et `next.config.mjs` (qui lit la
 * variable d'environnement).
 */
export const E2E_DIST_DIR = ".next-e2e";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TS_CONFIG_PATH = path.join(PROJECT_ROOT, "tsconfig.json");

// L'instantané vit hors du dépôt (rien n'est ajouté à l'arbre de travail) et
// son nom dépend du chemin du worktree : plusieurs worktrees peuvent exécuter
// la suite en parallèle sans se marcher dessus.
const PROJECT_KEY = crypto
  .createHash("sha1")
  .update(PROJECT_ROOT)
  .digest("hex")
  .slice(0, 12);
const SNAPSHOT_PATH = path.join(
  os.tmpdir(),
  `fsa-e2e-tsconfig-${PROJECT_KEY}.json`,
);

/** Vrai si `next dev` a déjà injecté les chemins de types du distDir E2E. */
function isRewrittenByNext(content: string): boolean {
  return content.includes(E2E_DIST_DIR);
}

/**
 * Mémorise `tsconfig.json` tel qu'il est AVANT que `next dev` ne le réécrive.
 *
 * Idempotent : Playwright charge la config plusieurs fois (runner, workers,
 * teardown) ; les chargements tardifs voient un fichier déjà réécrit et
 * n'écrasent donc jamais un instantané valide. Un instantané orphelin (run
 * interrompu brutalement) n'est remplacé que si le fichier courant est sain,
 * afin de préserver d'éventuelles éditions manuelles de l'utilisateur.
 */
export function snapshotTsconfig(): void {
  let current: Buffer;
  try {
    current = fs.readFileSync(TS_CONFIG_PATH);
  } catch {
    return; // Pas de tsconfig : rien à protéger.
  }

  if (isRewrittenByNext(current.toString("utf8"))) return;

  fs.writeFileSync(SNAPSHOT_PATH, current);
}

/**
 * Restaure l'instantané dans `tsconfig.json`, puis le consomme. On écrit les
 * octets exacts (fins de ligne comprises) pour rendre l'arbre de travail
 * strictement identique à son état initial. Sans instantané, ne fait rien.
 */
export function restoreTsconfig(): void {
  let snapshot: Buffer;
  try {
    snapshot = fs.readFileSync(SNAPSHOT_PATH);
  } catch {
    return;
  }

  fs.writeFileSync(TS_CONFIG_PATH, snapshot);
  fs.rmSync(SNAPSHOT_PATH, { force: true });
}
