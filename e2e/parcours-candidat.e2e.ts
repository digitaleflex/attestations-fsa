/**
 * Parcours candidat de bout en bout (issue #139, EPIC #131 / slice #160).
 *
 * Prouve : un candidat réel s'authentifie, passe un examen officiel (QCM),
 * obtient un résultat réussi, reçoit une attestation émise par le flux
 * applicatif, la télécharge, et son code est accepté par la page publique de
 * vérification.
 *
 * ⚠️ Le passage de l'examen se fait ici par les ENDPOINTS applicatifs
 * (`POST /api/exams/[id]/start` puis `/submit`) appelés depuis le contexte
 * navigateur authentifié — donc avec les vrais cookies de session et le vrai
 * scoring serveur. La version 100 % interface du même parcours existe dans
 * `e2e/ui-examen.e2e.ts` : elle échoue sur un défaut applicatif réel (voir ce
 * fichier et le rapport #139). Le chemin API est utilisé ici pour ne pas
 * masquer le défaut UI tout en prouvant le reste de la chaîne.
 *
 * Les tests sont ordonnés (workers: 1) et partagent l'état applicatif de la
 * base E2E : le test 2 produit la session + l'attestation que les tests 3 et 4
 * consomment. Aucune attestation n'est insérée en base par le harnais.
 */
import { test, expect } from "@playwright/test";
import { loginAsCandidate } from "./support/auth";
import { getIssuedCertification, getSeededExam } from "./support/database";

test.describe("Parcours candidat de bout en bout (#139)", () => {
  test("1. authentification : le candidat semé atteint son espace", async ({
    page,
  }) => {
    await loginAsCandidate(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    // L'espace candidat est rendu avec l'identité du compte semé.
    await expect(
      page.getByRole("heading", { name: "Tableau de bord" }),
    ).toBeVisible();
    // Le nom du compte apparaît légitimement plusieurs fois sur la page
    // (en-tête, fiche « Nom complet », carte profil). On cible la carte profil,
    // non ambiguë, plutôt que de relâcher l'assertion d'identité.
    await expect(
      page.getByRole("paragraph").filter({ hasText: "Jean Koffi" }),
    ).toBeVisible();
  });

  test("2. cœur métier : il passe le QCM et obtient un résultat réussi", async ({
    page,
  }) => {
    const exam = await getSeededExam();
    expect(exam.questions.length).toBeGreaterThan(0);

    await loginAsCandidate(page);

    // L'examen semé est SCHEDULED avec scheduledAt dans le passé :
    // `autoOpenDueExams()` doit l'avoir ouvert et il doit être proposé.
    await page.goto("/exams");
    await expect(page.getByRole("heading", { name: exam.name })).toBeVisible();
    await expect(
      page.locator(`a[href="/exams/${exam.id}"]`),
    ).toBeVisible();

    // Démarrage par l'endpoint réel, dans le contexte authentifié.
    const startResponse = await page.request.post(`/api/exams/${exam.id}/start`);
    expect(startResponse.status()).toBe(201);

    // Toutes les bonnes réponses QCM (jamais exposées par l'API — oracle DB).
    const answers: Record<string, string> = {};
    for (const question of exam.questions) {
      answers[question.id] = question.correctOptionId;
    }

    const submitResponse = await page.request.post(
      `/api/exams/${exam.id}/submit`,
      { data: { answers } },
    );
    expect(
      submitResponse.status(),
      `soumission refusée : ${await submitResponse.text()}`,
    ).toBe(201);

    const submitBody = (await submitResponse.json()) as {
      status: string;
      finalScore: number;
      maxScore: number;
    };
    expect(submitBody.status).toBe("COMPLETED");
    expect(submitBody.finalScore).toBe(100);
    expect(submitBody.maxScore).toBe(20);

    // Le résultat est visible dans l'espace candidat.
    await page.goto("/results");
    await expect(page.getByText("Réussi", { exact: true })).toBeVisible();
    // Deux « 100% » légitimes : la statistique « Moyenne générale » et le score
    // du résultat. On cible sans ambiguïté la carte du résultat d'examen.
    const resultCard = page
      .locator("div.rounded-2xl")
      .filter({ has: page.getByRole("heading", { name: exam.name }) });
    await expect(resultCard.getByText("100%", { exact: true })).toBeVisible();
  });

  test("3. certificat : l'attestation est émise par le flux applicatif, puis visible", async ({
    page,
  }) => {
    // Oracle base : l'attestation doit exister côté serveur, insérée par
    // `issueExamAttestation` lors de la soumission — jamais par le harnais.
    const certification = await getIssuedCertification();
    expect(
      certification,
      "aucune attestation CERTIFICATION émise pour le candidat après soumission",
    ).not.toBeNull();
    expect(certification!.status).toBe("VALIDATED");
    expect(certification!.code).toMatch(/^FSA-\d{4}-M\d{2}-\d{5}-[0-9a-f]{5}$/);
    expect(certification!.sessionId).toBeTruthy();

    await loginAsCandidate(page);

    // Détail du résultat (page /results/[id]) accessible depuis la session.
    await page.goto(`/results/${certification!.sessionId}`);
    await expect(page.getByText("Réussi", { exact: true })).toBeVisible();

    // L'attestation apparaît dans l'espace candidat avec son code réel.
    await page.goto("/attestations");
    // `exact` évite la seconde occurrence « code de l'attestation : <code> »
    // rendue par l'aperçu du certificat présent sur la page.
    await expect(
      page.getByText(certification!.code, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Validée").first()).toBeVisible();
  });

  test("4. boucle complète : téléchargement + code accepté par la page publique", async ({
    page,
  }) => {
    const certification = await getIssuedCertification();
    expect(certification).not.toBeNull();
    const code = certification!.code;

    await loginAsCandidate(page);
    await page.goto("/attestations");

    // Aperçu officiel → page /attestations/[id]
    await page.getByRole("link", { name: /Aperçu/ }).click();
    await page.waitForURL(/\/attestations\/[0-9a-f-]+$/);
    // `exact` cible l'en-tête de la page (`<p>` = le code seul) et non les
    // mentions « Réf: <code>… » / « CODE: <code> » du document officiel.
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    // Téléchargement PDF généré côté client (html2pdf).
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: /Télécharger \(PDF\)/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(code.slice(-5));

    // Boucle complète : le code émis par le flux applicatif est authentifié
    // par la page publique de vérification.
    await page.goto(`/verifier?code=${encodeURIComponent(code)}`);
    // Le certificat affiche le code sous deux formes (`Réf: …` et `CODE: …`) :
    // on cible la mention officielle « CODE: », non ambiguë.
    await expect(page.getByText(`CODE: ${code}`)).toBeVisible();
    await expect(page.getByText("Jean Koffi")).toBeVisible();
  });
});
