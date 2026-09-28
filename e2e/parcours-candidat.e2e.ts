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
 * Le parcours métier reste dans un seul test afin qu'un échec d'interface ne
 * laisse pas une boucle de téléchargement dépendante d'un test précédent. Ce
 * test ne peut pas être rejoué après une mutation réussie : son retry est
 * désactivé explicitement. Aucune attestation n'est insérée par le harnais.
 */
import { test, expect } from "@playwright/test";
import { loginAsCandidate } from "./support/auth";
import { getIssuedCertification, getSeededExam } from "./support/database";

test.describe("Parcours candidat de bout en bout (#139)", () => {
  // Le parcours métier mute la session et l'attestation : un retry ne peut pas
  // repartir d'un état propre sans rejouer le globalSetup.
  test.describe.configure({ retries: 0 });

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

  test("2. parcours complet : réussite, attestation, téléchargement et vérification", async ({
    page,
  }) => {
    const exam = await getSeededExam();
    expect(exam.questions.length).toBeGreaterThan(0);

    await loginAsCandidate(page);

    // L'examen semé est SCHEDULED avec `scheduledAt` dans le passé : il est
    // ouvert et démarrable (`hasOpened`), sans dépendre d'un basculement de
    // statut par une route publique.
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
    expect(submitBody.status).toBe("GRADED");
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

    // Détail du résultat (page /results/[id]) accessible depuis la session.
    // `next dev` compile cette route dynamique et son API à la PREMIÈRE visite :
    // le rendu reste en `isLoading` tant que `GET /api/user/results/[id]` n'a pas
    // répondu. On attend donc explicitement cette réponse (200) avant d'assertir
    // l'UI, pour ne jamais échouer sur une compilation lente (#139).
    const detailUrl = `/api/user/results/${certification!.sessionId}`;
    const detailResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes(detailUrl),
      { timeout: 90_000 },
    );
    await page.goto(`/results/${certification!.sessionId}`);
    const detailResponse = await detailResponsePromise;
    expect(
      detailResponse.status(),
      `GET ${detailUrl} n'a jamais abouti (page bloquée en chargement)`,
    ).toBe(200);

    await expect(page.getByText("Réussi", { exact: true })).toBeVisible();

    // L'attestation apparaît dans l'espace candidat avec son code réel.
    await page.goto("/attestations");
    // `exact` évite la seconde occurrence « code de l'attestation : <code> »
    // rendue par l'aperçu du certificat présent sur la page.
    await expect(
      page.getByText(certification!.code, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Validée").first()).toBeVisible();

    // La boucle de téléchargement et la vérification publique appartiennent au
    // même test métier : elles réutilisent l'attestation qui vient d'être créée,
    // sans dépendre d'un test Playwright distinct.
    const code = certification!.code;

    // Aperçu officiel → page /attestations/[id]
    await page.getByRole("link", { name: /Aperçu/ }).click();
    await page.waitForURL(/\/attestations\/[0-9a-f-]+$/);
    // `exact` cible l'en-tête de la page (`<p>` = le code seul) et non les
    // mentions « Réf: <code>… » / « CODE: <code> » du document officiel.
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    // Téléchargement du document officiel (#258) : le PDF n'est plus fabriqué
    // dans le navigateur. Le bouton déclenche la redirection serveur vers
    // l'URL signée de courte durée — on vérifie donc le point de téléchargement
    // contrôlé plutôt que le nom de fichier proposé par le navigateur.
    const downloadButton = page.getByRole("button", { name: /Télécharger \(PDF\)/ });
    await expect(downloadButton).toBeEnabled();

    const verifier = await page.request.get(`/api/verifier?code=${encodeURIComponent(code)}`);
    expect(verifier.status()).toBe(200);
    const proof = (await verifier.json()) as {
      attestation?: { proof?: { valid?: boolean; pdf?: { available?: boolean; version?: number; downloadPath?: string } } };
    };
    expect(proof.attestation?.proof?.valid).toBe(true);
    expect(proof.attestation?.proof?.pdf?.available).toBe(true);
    expect(proof.attestation?.proof?.pdf?.version).toBe(1);

    // Redirection 307 vers l'URL signée : jamais d'URL signée persistée,
    // jamais de PDF régénéré à la volée.
    const pdf = await page.request.get(
      `/api/verifier/pdf?code=${encodeURIComponent(code)}`,
      { maxRedirects: 0 },
    );
    expect(pdf.status()).toBe(307);
    expect(pdf.headers()["cache-control"]).toBe("private, no-store, max-age=0");

    // Boucle complète : le code émis par le flux applicatif est authentifié
    // par la page publique de vérification.
    await page.goto(`/verifier?code=${encodeURIComponent(code)}`);
    // Le certificat affiche le code sous deux formes (`Réf: …` et `CODE: …`) :
    // on cible la mention officielle « CODE: », non ambiguë.
    await expect(page.getByText(`CODE: ${code}`)).toBeVisible();
    await expect(page.getByText("Jean Koffi")).toBeVisible();
  });
});
