/**
 * Parcours candidat via l'INTERFACE (issue #139).
 *
 * ⚠️ CE TEST ÉCHOUE ET DOIT RESTER VISIBLE : il reproduit un défaut applicatif
 * réel et bloquant. Le rapport #139 documente symptôme / attendu / observé /
 * localisation.
 *
 * Symptôme : dès l'ouverture de `/exams/[id]`, la page déclenche un déluge de
 * `POST /api/exams/monitoring` (mesuré : 64 requêtes en 8 s, sans aucune
 * interaction), la page se fige puis le serveur meurt (`memory allocation of
 * 1048576 bytes failed`). Le clic sur « Soumettre » ne se termine jamais.
 *
 * Cause probable (fichier:ligne) :
 *  - `app/(user)/exams/[id]/page.tsx:58-76` : la prop `onEnforcement` est une
 *    fonction inline, recréée à chaque rendu, donc l'effet de
 *    `lib/useExamMonitoring.ts:102-178` est re-monté à chaque rendu ;
 *  - `lib/useExamMonitoring.ts:105` : `enterFullscreen()` échoue (pas
 *    d'activation utilisateur au montage) → `lib/useExamMonitoring.ts:90-92`
 *    pousse un événement → `setState` → nouveau rendu → nouvel effet → boucle ;
 *  - `lib/useExamMonitoring.ts:174-176` : le nettoyage de l'effet poste les
 *    événements en attente à chaque démontage, soit une requête par boucle.
 *
 * Ce fichier est exécuté en DERNIER (projet Playwright dédié) car la boucle
 * finit par faire tomber le serveur de test.
 */
import { test, expect } from "@playwright/test";
import { loginAsCandidate } from "./support/auth";
import { getUiExam } from "./support/database";

test("parcours interface : démarrer l'examen, répondre au QCM, soumettre", async ({
  page,
}) => {
  const exam = await getUiExam();
  expect(exam.questions.length).toBeGreaterThan(0);

  await loginAsCandidate(page);
  await page.goto(`/exams/${exam.id}`);

  // 1) Le démarrage doit aboutir côté serveur (enregistrement de la session).
  const startResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/exams/${exam.id}/start`),
    { timeout: 30_000 },
  );

  const startButton = page.getByRole("button", {
    name: /DÉMARRER MON EXAMEN/i,
  });
  await expect(startButton).toBeVisible();
  await page.getByRole("checkbox").check();
  await startButton.click();

  const startResponse = await startResponsePromise;
  expect(
    startResponse.status(),
    "POST /api/exams/[id]/start n'a jamais abouti (page saturée par la boucle de monitoring)",
  ).toBe(201);

  // 2) Le QCM doit être répondable.
  await expect(
    page.getByRole("heading", { name: "Partie 1 - QCM" }),
  ).toBeVisible();

  for (let index = 0; index < exam.questions.length; index += 1) {
    const question = exam.questions[index];
    await expect(page.getByText(question.text)).toBeVisible();
    await page.locator(`[id="${question.correctOptionId}"]`).click();

    if (index < exam.questions.length - 1) {
      await page.getByRole("button", { name: "Suivant" }).click();
    }
  }

  // 3) La soumission doit aboutir et mener aux résultats.
  await page.getByRole("button", { name: "Soumettre" }).click();
  await page.waitForURL(/\/results$/, { timeout: 30_000 });
  await expect(page.getByText("Réussi", { exact: true })).toBeVisible();
});
