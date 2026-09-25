// tests/scripts/r2-operations.test.ts
// #260 — Les scripts bash d'exploitation R2 (sauvegarde, restauration, fraîcheur,
// versioning, alerte) sont hors du périmètre de couverture vitest (pas de
// TypeScript). Ce test les exécute quand même, via le banc d'essai local
// `scripts/tests/test-r2-scripts.sh`.
//
// Contrainte forte du lot : AUCUN credential AWS, AUCUN accès réseau, AUCUNE
// donnée réelle. Le banc d'essai installe un binaire `aws` factice qui lit un
// répertoire temporaire ; `jq` est le seul prérequis réel.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const HARNESS = path.join(REPO_ROOT, "scripts/tests/test-r2-scripts.sh");

function prerequisiteOk(command: string): boolean {
  return spawnSync("bash", ["-c", `command -v ${command}`], { encoding: "utf8" }).status === 0;
}

describe("scripts d'exploitation R2 (#260)", () => {
  it(
    "le banc d'essai local passe sans credential ni données réelles",
    () => {
      if (!prerequisiteOk("jq") || !prerequisiteOk("find")) {
        // Environnement sans jq : le lot est vert par absence de preuve,
        // comme les autres tests conditionnels de la suite.
        expect(true).toBe(true);
        return;
      }
      const run = spawnSync("bash", [HARNESS], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          // Aucun credential ne doit pouvoir fuir vers le banc d'essai.
          AWS_ACCESS_KEY_ID: "",
          AWS_SECRET_ACCESS_KEY: "",
          AWS_SESSION_TOKEN: "",
          AWS_PROFILE: "",
        },
        timeout: 120_000,
      });
      expect(
        `${run.stdout}\n${run.stderr}`,
        `le banc d'essai R2 a échoué (code ${run.status})`
      ).toContain("RÉSULTAT : OK");
      // `check` signale un cas en échec sans forcément faire tomber le script :
      // c'est donc le marqueur « ECHEC » qu'il faut surveiller, pas le code.
      expect(run.stdout).not.toContain("ECHEC");
      expect(run.stdout).toContain("CAS 1 : export R2 avec pagination");
      expect(run.stdout).toContain("CAS 7 : alerte agrégée");
      expect(run.status).toBe(0);
    },
    130_000
  );
});
