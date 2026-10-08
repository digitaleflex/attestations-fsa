/**
 * Setup global Vitest (issue #11), branché via `setupFiles` dans
 * `vitest.config.ts`.
 *
 * - Charge `.env.test` SANS écraser l'environnement existant (les variables
 *   déjà définies — CI, shell — restent prioritaires).
 * - Remplit les secrets indispensables au chargement des modules (`lib/auth`,
 *   `lib/prisma`) avec des valeurs FACTICES quand ils sont absents.
 *
 * NE JAMAIS y mettre de vrais secrets. Les variables Redis sont
 * volontairement ABSENTES : les définir (même factices) ferait passer
 * `isRedisReady()` à vrai et casserait les tests du fallback mémoire.
 * Même règle pour CERT_SEAL_SECRET, CRON_SECRET et RESEND_API_KEY, dont
 * l'absence ambiante est supposée par les tests existants.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.test") });

const TEST_DEFAULTS: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5433/attestations_fsa_test",
  BETTER_AUTH_SECRET: "test-only-secret-min-32-chars-0123456789abcdef",
  AUTH_SECRET: "test-only-secret-min-32-chars-0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  APP_TIMEZONE: "Africa/Porto-Novo",
};

for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}
