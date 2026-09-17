/**
 * Parcours candidat via l'INTERFACE (issue #139).
 *
 * Prouve qu'un candidat réel, depuis l'interface seule, démarre un examen
 * officiel (`/exams/[id]`), répond au QCM puis soumet ; `/results` affiche
 * alors le résultat réussi.
 *
 * Historique : ce test reproduisait un défaut applicatif réel — dès l'ouverture
 * de `/exams/[id]`, une boucle de `POST /api/exams/monitoring` saturait la page
 * puis tuait le serveur (`memory allocation of 1048576 bytes failed`). Ce
 * défaut a été corrigé (cf. #220). Restait alors une ambiguïté de test :
 * `/results` liste TOUS les résultats du candidat, donc plusieurs badges
 * « Réussi » coexistent légitimement (celui du parcours API de
 * `parcours-candidat.e2e.ts` et celui-ci). L'assertion est scopée sur la carte
 * du bon examen, sans affaiblir ce qu'elle prouve.
 *
 * Exécuté en DERNIER (projet Playwright dédié) : parcours navigateur complet,
 * le plus long de la suite.
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

  // La page /results liste TOUS les résultats du candidat : l'examen UI mais
  // aussi celui déjà produit par `parcours-candidat.e2e.ts`. Deux cartes
  // réussies portent donc légitimement le badge « Réussi ». On scrope sur la
  // carte de l'examen qui vient d'être passé (même motif que
  // `parcours-candidat.e2e.ts`), sinon l'assertion n'identifierait pas le bon
  // résultat et masquerait un éventuel échec.
  const resultCard = page
    .locator("div.rounded-2xl")
    .filter({ has: page.getByRole("heading", { name: exam.name }) });
  await expect(resultCard.getByText("Réussi", { exact: true })).toBeVisible();
});
