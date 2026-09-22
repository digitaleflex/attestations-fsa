import { defineConfig, devices } from "@playwright/test";
import { E2E_APP_PORT, E2E_BASE_URL, getE2eDatabaseUrl } from "./e2e/setup/env";
import { E2E_DIST_DIR, snapshotTsconfig } from "./e2e/setup/tsconfig-restore";

/**
 * Configuration Playwright — parcours candidat E2E (issue #139).
 *
 * L'application est démarrée PAR la suite (webServer) sur un port dédié
 * (3100) pour ne pas toucher au serveur de dev de l'utilisateur (3000).
 * La `DATABASE_URL` de la base E2E (conteneur Docker, port 5434) est
 * injectée par l'environnement : `.env.local` n'est jamais modifié.
 */
// `next dev` réécrit `tsconfig.json` dès son démarrage (reformatage + ajout
// des chemins de types de `.next-e2e`). Le `webServer` étant démarré AVANT
// `globalSetup`, on capture l'état initial ici, au chargement de la config ;
// `globalTeardown` le restaure après le run (voir tsconfig-restore.ts).
snapshotTsconfig();

const databaseUrl = getE2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  // Les specs Playwright sont nommées *.e2e.ts pour que Vitest (dont le
  // glob par défaut est *.{test,spec}.ts) ne les ramasse jamais.
  testMatch: /.*\.e2e\.ts/,
  // Le parcours est séquentiel : il mute un état partagé (sessions, attestation).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  timeout: 150_000,
  expect: { timeout: 20_000 },
  globalSetup: "./e2e/setup/global-setup.ts",
  globalTeardown: "./e2e/setup/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      // Parcours prouvés (auth, endpoints applicatifs, certificat, vérification).
      name: "chromium",
      testIgnore: /ui-examen\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Versant ADMIN du cœur métier (issue #140) : connexion par mot de passe
      // (#230), consultation et révocation d'attestation. Dépend de l'attestation
      // émise par le parcours candidat → déclaré APRÈS `chromium`.
      name: "chromium-admin",
      testMatch: /parcours-admin\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Parcours 100 % interface, exécuté en dernier (projet dédié) : c'est le
      // scénario navigateur complet, le plus long de la suite.
      name: "chromium-ui-examen",
      testMatch: /ui-examen\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `next dev -p ${E2E_APP_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    // ⚠️ Toujours faux, y compris en local : un `next dev` résiduel sur 3100
    // (lancé avant un `pnpm install`, donc avec une résolution de modules
    // cassée) a déjà produit 6 faux échecs en étant silencieusement réutilisé.
    // Ici Playwright refuse bruyamment de réutiliser le port occupé et démarre
    // son propre serveur : la suite est auto-protégée.
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      BETTER_AUTH_URL: E2E_BASE_URL,
      // distDir dédié : permet de cohabiter avec le `next dev` de l'utilisateur
      // (Next verrouille `<distDir>/dev/lock`). Voir next.config.mjs.
      NEXT_DIST_DIR: E2E_DIST_DIR,
      // Rate limiting : on force le fallback mémoire (cf. lib/rate-limit.ts)
      // pour que les quotas (5 soumissions/h, 10 vérifs/h) se réinitialisent
      // à chaque démarrage du serveur de test et ne dépendent pas d'un Redis
      // partagé. La valeur "" est conservée par @next/env (une variable déjà
      // définie dans process.env n'est jamais écrasée par .env.local).
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    },
  },
});
