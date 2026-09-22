/**
 * Environnement des tests E2E (issue #139).
 *
 * Rien de sensible n'est lu ici : on DÉRIVE l'URL de la base E2E depuis le
 * `.env.local` de l'utilisateur (qui n'est jamais modifié) et on ne renvoie
 * jamais la valeur (mot de passe compris) dans un log ou un rapport.
 *
 * Base E2E : conteneur Docker `attestations-fsa-postgres`, port hôte 5434,
 * base `attestation_fsa_e2e`. La base de dev (port 5432 / `attestation_fsa`)
 * ne doit JAMAIS être touchée par la suite E2E.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, ".env.local");

/** Port applicatif dédié aux tests : n'entre pas en conflit avec le dev (3000). */
export const E2E_APP_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_APP_PORT}`;

const E2E_DB_HOST_PORT = "5434";
const E2E_DB_NAME = "attestation_fsa_e2e";
const DEV_DB_HOST_PORT = "5432";
const DEV_DB_NAME = "attestation_fsa";

/** Compte candidat semé par `prisma/seed.ts` (fixture de test, pas un secret de prod). */
export const CANDIDATE_EMAIL = process.env.E2E_CANDIDATE_EMAIL ?? "candidat@example.com";
export const CANDIDATE_PASSWORD = process.env.E2E_CANDIDATE_PASSWORD ?? "Candidat123!";

/** Compte administrateur semé par `prisma/seed.ts` (fixture de test, pas un secret de prod). */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@fsa.bj";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminFSA1452.";

function readEnvLocal(): Record<string, string> {
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    throw new Error(
      `[e2e] .env.local introuvable (${ENV_LOCAL_PATH}). Impossible de dériver l'URL de la base E2E.`,
    );
  }
  return parseDotenv(fs.readFileSync(ENV_LOCAL_PATH, "utf8"));
}

/**
 * Échoue bruyamment plutôt que de laisser un test taper la mauvaise base.
 * Ne révèle jamais l'URL complète dans le message.
 */
function assertSafeE2eUrl(rawUrl: string): void {
  let parsed: URL;
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
        `Les tests E2E doivent utiliser ${E2E_DB_HOST_PORT} / ${E2E_DB_NAME}.`,
    );
  }

  if (port !== E2E_DB_HOST_PORT || database !== E2E_DB_NAME) {
    throw new Error(
      `[e2e] Refus : l'URL cible le port ${port} et la base "${database}". ` +
        `Attendu ${E2E_DB_HOST_PORT} / ${E2E_DB_NAME}.`,
    );
  }
}

function deriveFromEnvLocal(): string {
  const source = readEnvLocal().DATABASE_URL;
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

/**
 * URL de la base E2E. `E2E_DATABASE_URL` a priorité (CI / override explicite),
 * sinon dérivation depuis `.env.local`. Le port 5432 est refusé.
 */
export function getE2eDatabaseUrl(): string {
  const override = process.env.E2E_DATABASE_URL?.trim();
  const url = override ? override : deriveFromEnvLocal();
  assertSafeE2eUrl(url);
  return url;
}
