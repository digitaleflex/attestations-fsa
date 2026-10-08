/**
 * Parcours stage de bout en bout (issue #272).
 *
 * Prouve la chaîne métier des demandes de stage, strictement sans toucher à
 * la base autrement que par les routes réelles :
 *   1. dépôt public (`POST /api/public/internships`, multipart + CV PDF) —
 *      sans authentification, comme un vrai candidat externe ;
 *   2. décision admin : `PENDING → REVIEWING` (route détail) puis
 *      `REVIEWING → ACCEPTED` (route collection), avec `allowedTransitions`
 *      renvoyées par la machine à états (#267) ;
 *   3. export XLSX (`GET /api/admin/internships/export`) : 200, contenu
 *      tableur non vide ;
 *   4. sentinelle d'émission : l'attestation est REFUSÉE en 409
 *      `INCOMPLETE_IDENTITY` car un dépôt public n'est lié à aucun dossier
 *      utilisateur (identité jamais inventée — cf.
 *      `lib/stage-attestation/issue.ts:resolveIdentity`), après avoir prouvé
 *      que la validation stricte (#266) rejette un corps incohérent en 400.
 *
 * Le fichier est autonome : chaque test résout la demande créée au test 1
 * par son email unique (`?status=…&pageSize=100`, tri `createdAt desc`), sans
 * dépendre du parcours candidat ni du parcours admin.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./support/auth";

const STAMP = Date.now();
const STAGE_EMAIL = `stage.e2e.${STAMP}@example.com`;
const STAGE_FULL_NAME = `Stagiaire E2E ${STAMP}`;
const STAGE_POSITION = `Pisciculture E2E ${STAMP}`;

/** CV minimal réellement valide (en-tête PDF, < 3 Mo, jamais un faux type). */
function fakeCvBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
    "utf-8",
  );
}

interface InternshipListResponse {
  requests: Array<{
    id: string;
    email: string;
    fullName: string;
    status: string;
  }>;
  pagination: { total: number };
}

/** Retrouve la demande déposée au test 1 parmi la liste admin. */
async function findStageRequest(
  page: Page,
  status?: string,
): Promise<{ id: string; status: string }> {
  const query = status
    ? `?status=${status}&page=1&pageSize=100`
    : `?page=1&pageSize=100`;
  const listResponse = await page.request.get(`/api/admin/internships${query}`);
  expect(listResponse.status()).toBe(200);
  const body = (await listResponse.json()) as InternshipListResponse;
  const request = body.requests.find((r) => r.email === STAGE_EMAIL);
  expect(request, "demande de stage E2E introuvable dans la liste admin").toBeTruthy();
  return { id: request!.id, status: request!.status };
}

test.describe("Parcours stage de bout en bout (#272)", () => {
  test("1. un visiteur dépose une demande de stage avec son CV", async ({
    page,
  }) => {
    // Sans CV : 400 explicite (jamais d'enregistrement partiel).
    const missingCvResponse = await page.request.post(
      "/api/public/internships",
      {
        multipart: {
          fullName: STAGE_FULL_NAME,
          email: STAGE_EMAIL,
          phone: "+22997000000",
          position: STAGE_POSITION,
          message: "Motivation du parcours E2E #272.",
        },
      },
    );
    expect(missingCvResponse.status()).toBe(400);

    // Dépôt complet : 201 avec la demande persistée (statut PENDING).
    const depositResponse = await page.request.post(
      "/api/public/internships",
      {
        multipart: {
          fullName: STAGE_FULL_NAME,
          email: STAGE_EMAIL,
          phone: "+22997000000",
          position: STAGE_POSITION,
          university: "UNSTIM",
          level: "L3",
          message: "Motivation du parcours E2E #272.",
          file: {
            name: "cv.pdf",
            mimeType: "application/pdf",
            buffer: fakeCvBuffer(),
          },
        },
      },
    );
    expect(
      depositResponse.status(),
      `dépôt refusé : ${await depositResponse.text()}`,
    ).toBe(201);
    const deposit = (await depositResponse.json()) as {
      id: string;
      status: string;
      email: string;
    };
    expect(deposit.id).toBeTruthy();
    expect(deposit.status).toBe("PENDING");
    expect(deposit.email).toBe(STAGE_EMAIL);
  });

  test("2. l'admin instruit la demande (REVIEWING) puis l'accepte", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Statut hors enum : 400 `INVALID_INTERNSHIP_STATUS`, sans écriture.
    const invalidResponse = await page.request.patch(
      "/api/admin/internships",
      { data: { id: "inexistant", status: "SUPPRIME" } },
    );
    expect(invalidResponse.status()).toBe(400);
    expect(
      ((await invalidResponse.json()) as { code: string }).code,
    ).toBe("INVALID_INTERNSHIP_STATUS");

    // PENDING → REVIEWING par la route détail (prouve `allowedTransitions`).
    const pending = await findStageRequest(page, "PENDING");
    const reviewingResponse = await page.request.patch(
      `/api/admin/internships/${pending.id}`,
      { data: { status: "REVIEWING" } },
    );
    expect(
      reviewingResponse.status(),
      `passage en REVIEWING refusé : ${await reviewingResponse.text()}`,
    ).toBe(200);
    const reviewing = (await reviewingResponse.json()) as {
      status: string;
      allowedTransitions: string[];
    };
    expect(reviewing.status).toBe("REVIEWING");
    expect(reviewing.allowedTransitions).toContain("ACCEPTED");

    // REVIEWING → ACCEPTED par la route collection (prouve les deux formes).
    const acceptedResponse = await page.request.patch(
      "/api/admin/internships",
      { data: { id: pending.id, status: "ACCEPTED" } },
    );
    expect(
      acceptedResponse.status(),
      `acceptation refusée : ${await acceptedResponse.text()}`,
    ).toBe(200);

    // La transition interdite REJECTED → ACCEPTED serait refusée : on prouve
    // ici le corollaire positif — la demande acceptée est bien retrouvée.
    const accepted = await findStageRequest(page, "ACCEPTED");
    expect(accepted.id).toBe(pending.id);
  });

  test("3. l'admin exporte les demandes au format tableur", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const exportResponse = await page.request.get(
      "/api/admin/internships/export?page=1&pageSize=20",
    );
    expect(exportResponse.status()).toBe(200);
    const contentType = exportResponse.headers()["content-type"] ?? "";
    expect(
      contentType,
      `export inattendu (content-type: ${contentType})`,
    ).toMatch(/spreadsheet|excel|octet-stream/);
    expect((await exportResponse.body()).length).toBeGreaterThan(0);

    // La page admin des stages rend sa liste (la demande ACCEPTÉE y figure
    // via la pagination serveur, filtre ALL par défaut).
    await page.goto("/admin/internships");
    await expect(page.getByText(STAGE_FULL_NAME).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("4. l'émission est refusée sans dossier utilisateur lié (sentinelle)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const accepted = await findStageRequest(page, "ACCEPTED");

    // Corps incohérent (fin avant début) : 400 `VALIDATION_ERROR` — la
    // validation stricte #266 répond avant toute lecture métier.
    const invalidBodyResponse = await page.request.post(
      `/api/admin/internships/${accepted.id}/attestation`,
      { data: { startDate: "2026-06-15", endDate: "2026-01-15" } },
    );
    expect(invalidBodyResponse.status()).toBe(400);

    // Corps cohérent mais demande non liée à un utilisateur : 409
    // `INCOMPLETE_IDENTITY`. Le dépôt public ne crée jamais de `userId`, et
    // l'émission refuse d'inventer date/lieu de naissance sur un document
    // officiel — c'est le comportement spécifié, prouvé de bout en bout.
    const sentinelResponse = await page.request.post(
      `/api/admin/internships/${accepted.id}/attestation`,
      {
        data: {
          startDate: "2026-01-15",
          endDate: "2026-06-15",
          location: "Abomey-Calavi",
          instructor: "Formateur Ferme St André",
          stageScore: 16,
          stageObservations: "Stage effectué avec succès (E2E #272).",
        },
      },
    );
    expect(sentinelResponse.status()).toBe(409);
    expect(
      ((await sentinelResponse.json()) as { code: string }).code,
    ).toBe("INCOMPLETE_IDENTITY");

    // La demande reste ACCEPTED : le refus n'a rien archivé, rien émis.
    const kept = await findStageRequest(page, "ACCEPTED");
    expect(kept.id).toBe(accepted.id);
  });
});
