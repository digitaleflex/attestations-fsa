import { defineConfig, devices } from "@playwright/test";
import {
  E2E_APP_PORT,
  E2E_BASE_URL,
  E2E_CERT_SEAL_SECRET,
  E2E_PDF_GENERATOR_MODULE,
  E2E_STORAGE_DIR,
  E2E_TEST_PDF_GENERATOR,
  getE2eDatabaseUrl,
} from "./e2e/setup/env";
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
      testIgnore: /(ui-examen|parcours-admin)\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Versant ADMIN du cœur métier (issue #140) : connexion par mot de passe
      // (#230), consultation et révocation d'attestation. Dépend de l'attestation
      // émise par le parcours candidat → déclaré APRÈS `chromium`.
      name: "chromium-admin",
      testMatch: /parcours-admin\.e2e\.ts/,
      dependencies: ["chromium"],
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
      // ── Émission d'attestation + preuve PDF (#258) ─────────────────────
      // Le flux métier n'émet une CERTIFICATION que si un générateur PDF
      // SERVEUR est configuré. La suite charge ici une fixture locale
      // (`e2e/fixtures/pdf-generator.mjs`) qui produit un PDF minimal
      // réellement valide : aucun document officiel n'est simulé, et toute la
      // chaîne réelle (génération → stockage → SHA-256 → scellement →
      // vérification publique → redirection 307) est bien exercée.
      ATTESTATION_PDF_GENERATOR_MODULE: E2E_PDF_GENERATOR_MODULE,
      // Double garde de la fixture : sans ce marqueur (ou en NODE_ENV
      // =production) elle refuse de produire le moindre octet.
      E2E_TEST_PDF_GENERATOR: E2E_TEST_PDF_GENERATOR,
      // Clé de scellement factice, propre à la suite. Sans elle,
      // `issueExamAttestation` refuse d'émettre (blocage #155) ET le
      // vérificateur ne peut pas prouver la validité du sceau.
      CERT_SEAL_SECRET: E2E_CERT_SEAL_SECRET,
      // Stockage des PDF du run hors `public/` : le bucket de production est
      // privé, le PDF E2E ne doit donc pas être servi en statique par
      // `next dev` ni laisser d'artefact non suivi dans l'arbre de travail.
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: E2E_STORAGE_DIR,
      // Préfixe PUBLIC ABSOLU : `/api/verifier/pdf` fait un
      // `NextResponse.redirect(url)`, qui refuse une URL relative
      // (« URL is malformed »). En production, le driver S3/R2 renvoie
      // toujours une URL signée absolue ; le driver local doit donc être
      // configuré avec une origine explicite pour que la suite prouve la
      // redirection 307 + `no-store` au lieu d'un 500 de configuration.
      STORAGE_PUBLIC_PREFIX: `${E2E_BASE_URL}/uploads`,
    },
  },
});
