/**
 * Vérification publique d'authenticité + verrouillage des examens (issue #139).
 *
 * Ces tests sont indépendants du parcours candidat : ils n'exploitent que des
 * données semées en lecture seule ou des codes inexistants.
 */
import { test, expect } from "@playwright/test";
import { loginAsCandidate } from "./support/auth";
import {
  getLockedExam,
  getUnenrolledOfficialExam,
} from "./support/database";

test.describe("Vérification publique et verrouillage des examens", () => {
  test("un code inexistant affiche le message d'erreur attendu", async ({
    page,
  }) => {
    await page.goto("/verifier?code=FSA-2000-M01-99999-fffff");

    await expect(
      page.getByRole("heading", { name: "Aucun certificat trouvé" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Réessayer" }),
    ).toBeVisible();
  });

  test("un code trop court est refusé par la validation du formulaire", async ({
    page,
  }) => {
    await page.goto("/verifier");
    await page.getByPlaceholder(/FSA-2026/).fill("ab");
    await page.getByRole("button", { name: "Vérifier" }).click();

    // Le message de validation est rendu DEUX fois : le résumé visible
    // (`role="alert"`, focalisé) et un `<p class="sr-only">` relié au champ par
    // `aria-describedby`. `getByText` seul voit les deux (strict mode : 2
    // éléments). On cible donc le résumé par son rôle, sans relâcher
    // l'assertion sur le texte du message.
    const validationSummary = page
      .getByRole("alert")
      .filter({ hasText: "Veuillez entrer au moins 3 caractères" });
    await expect(validationSummary).toBeVisible();
    await expect(validationSummary).toHaveText(
      "Le code saisi contient une erreur : Veuillez entrer au moins 3 caractères",
    );
  });

  test("un OFFICIAL sans enrollment est interdit en lecture et au démarrage", async ({
    page,
  }) => {
    const exam = await getUnenrolledOfficialExam();
    await loginAsCandidate(page);

    const detailResponse = await page.request.get(`/api/exams/${exam.id}`);
    expect(detailResponse.status()).toBe(403);
    expect(((await detailResponse.json()) as { code?: string }).code).toBe(
      "EXAM_NOT_ENROLLED",
    );

    const startResponse = await page.request.post(
      `/api/exams/${exam.id}/start`,
    );
    expect(startResponse.status()).toBe(403);
    expect(((await startResponse.json()) as { code?: string }).code).toBe(
      "EXAM_NOT_ENROLLED",
    );
  });

  test("un examen programmé dans le futur reste verrouillé pour le candidat", async ({
    page,
  }) => {
    const lockedExam = await getLockedExam();
    await loginAsCandidate(page);

    // Lecture directe : l'API doit répondre 423 EXAM_LOCKED (commit ca09715).
    const detailResponse = await page.request.get(`/api/exams/${lockedExam.id}`);
    expect(detailResponse.status()).toBe(423);
    const detailBody = (await detailResponse.json()) as { code?: string };
    expect(detailBody.code).toBe("EXAM_LOCKED");

    // Démarrage impossible : l'examen existe mais n'est pas encore ouvert,
    // donc `start` répond 423 EXAM_LOCKED (et non 404, réservé à l'inconnu).
    const startResponse = await page.request.post(
      `/api/exams/${lockedExam.id}/start`,
    );
    expect(startResponse.status()).toBe(423);
    expect(((await startResponse.json()) as { code?: string }).code).toBe(
      "EXAM_LOCKED",
    );

    // L'UI l'annonce comme à venir, elle ne propose pas « Commencer ».
    await page.goto("/exams");
    await expect(
      page.getByRole("heading", { name: "Examens Programmés" }),
    ).toBeVisible();
    // Le même nom peut apparaître dans la section « Programmés » et dans la
    // liste générale pendant le chargement. Le test porte sur la carte
    // programmée : on sélectionne explicitement sa première occurrence.
    await expect(
      page.getByText(lockedExam.name, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/exams/${lockedExam.id}"]`),
    ).toHaveCount(0);
  });
});
