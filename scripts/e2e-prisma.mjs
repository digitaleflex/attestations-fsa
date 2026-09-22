/**
 * Wrapper cross-platform pour les commandes Prisma sur la base E2E.
 *
 * Résout l'URL via le flux établi (même logique que `e2e/setup/env.ts`) :
 *   1. `E2E_DATABASE_URL` (prioritaire — CI / override explicite) ;
 *   2. sinon dérivation depuis `.env.local` (port 5432 → 5434, base dev → e2e).
 *
 * Le port 5432 / la base `attestation_fsa` sont REFUSÉS : la suite E2E ne doit
 * jamais toucher la base de développement. Aucune valeur sensible n'est loggée.
 *
 * Usage : `node scripts/e2e-prisma.mjs migrate deploy` | `db seed`
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, ".env.local");

const E2E_DB_HOST_PORT = "5434";
const E2E_DB_NAME = "attestation_fsa_e2e";
const DEV_DB_HOST_PORT = "5432";
const DEV_DB_NAME = "attestation_fsa";

/** Échoue bruyamment plutôt que de laisser Prisma taper la mauvaise base. */
function assertSafeE2eUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("[e2e] L'URL de base E2E dérivée est invalide (non parsable).");
  }

  const port = parsed.port;
  const database = parsed.pathname.replace(/^\//, "");

  if (port === DEV_DB_HOST_PORT || database === DEV_DB_NAME) {
    throw new Error(
      `[e2e] Refus : l'URL cible la base de développement (port ${DEV_DB_HOST_PORT} / ${DEV_DB_NAME}). ` +
        `Les commandes E2E doivent utiliser ${E2E_DB_HOST_PORT} / ${E2E_DB_NAME}.`,
    );
  }

  if (port !== E2E_DB_HOST_PORT || database !== E2E_DB_NAME) {
    throw new Error(
      `[e2e] Refus : l'URL cible le port ${port} et la base "${database}". ` +
        `Attendu ${E2E_DB_HOST_PORT} / ${E2E_DB_NAME}.`,
    );
  }
}

function deriveFromEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    throw new Error(
      `[e2e] .env.local introuvable (${ENV_LOCAL_PATH}). Impossible de dériver l'URL de la base E2E.`,
    );
  }

  const raw = fs.readFileSync(ENV_LOCAL_PATH, "utf8");
  const match = raw.match(/^DATABASE_URL=(.+)$/m);
  const source = match ? match[1].trim() : undefined;
  if (!source) {
    throw new Error("[e2e] DATABASE_URL absent de .env.local.");
  }

  const e2eNeedle = `:${E2E_DB_HOST_PORT}/${E2E_DB_NAME}`;
  if (source.includes(e2eNeedle)) {
    return source;
  }

  const devNeedle = `:${DEV_DB_HOST_PORT}/${DEV_DB_NAME}`;
  const derived = source.replace(devNeedle, e2eNeedle);
  if (derived === source) {
    throw new Error(
      `[e2e] DATABASE_URL de .env.local ne contient pas "${devNeedle}" : ` +
        "dérivation impossible sans risque. Définissez E2E_DATABASE_URL explicitement.",
    );
  }
  return derived;
}

const url = process.env.E2E_DATABASE_URL?.trim() || deriveFromEnvLocal();
assertSafeE2eUrl(url);

const result = spawnSync("prisma", process.argv.slice(2), {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
});

process.exit(result.status ?? 1);