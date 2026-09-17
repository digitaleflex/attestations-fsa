/**
 * `globalSetup` Playwright : (re)prépare la base E2E avant la suite.
 *
 * Ne démarre pas l'application (c'est le rôle de `webServer` dans
 * `playwright.config.ts`) et n'écrit jamais d'attestation : voir `seed.ts`.
 */
import { createE2ePrismaClient } from "./db";
import { seedE2eData } from "./seed";
import { E2E_BASE_URL } from "./env";

/**
 * Pré-compile les routes les plus utilisées avant les tests.
 *
 * Le serveur E2E tourne en `next dev` : la première requête sur une route
 * coûte plusieurs secondes (compilation à la volée). Sans ce préchauffage,
 * les premiers tests frôlent leurs délais d'attente et deviennent instables.
 */
async function warmUpRoutes(): Promise<void> {
  const routes = [
    "/api/health",
    "/",
    "/auth",
    "/formations",
    "/examens",
    "/verifier",
    "/api/public/settings",
  ];

  for (const route of routes) {
    try {
      await fetch(`${E2E_BASE_URL}${route}`, { redirect: "manual" });
    } catch {
      // Le préchauffage est un confort : une route en échec ne doit pas
      // faire échouer la suite (les tests le constateront eux-mêmes).
    }
  }
}

export default async function globalSetup(): Promise<void> {
  const prisma = createE2ePrismaClient();
  try {
    const summary = await seedE2eData(prisma);
    console.log(
      `[e2e] seed OK — examen "${summary.examName}" ` +
        `(${summary.questionCount} questions QCM), candidat ${summary.candidateEmail}`,
    );
    if (summary.repairedCandidateCredential) {
      console.warn(
        "[e2e] ⚠️ BUG SEED APPLICATIF : le candidat semé n'avait aucun Account " +
          'providerId="credential" valide (prisma/seed.ts ne le crée que pour ' +
          "l'admin, avec un accountId incompatible better-auth 1.7). " +
          "Le harnais E2E a complété ce compte de test — à corriger côté seed.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  await warmUpRoutes();
}
