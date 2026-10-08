/**
 * Parcours administrateur de bout en bout (issue #140).
 *
 * Prouve le versant ADMIN du cœur métier — celui qui émet, corrige et révoque
 * les certificats — que le parcours candidat (#139) ne couvrait pas :
 *   1. connexion par mot de passe (prouve aussi #230 : le compte admin seedé
 *      se connecte enfin, `accountId === userId` depuis la PR #234) ;
 *   2. l'admin consulte l'attestation émise par le flux candidat ;
 *   3. l'admin la révoque avec un motif obligatoire (statut REJECTED).
 *
 * Dépendance d'état : les tests 2-3 exigent que le parcours candidat
 * (`chromium`) ait émis une attestation — le projet `chromium-admin` est donc
 * déclaré APRÈS `chromium` dans playwright.config.ts (workers: 1, séquentiel).
 *
 * Couverture étendue (tests 4-7) :
 *   4. création d'une formation (`POST /api/formations`) puis d'un examen
 *      DRAFT à 3 parties (`POST /api/exams`, 201), visibles via les listes ;
 *   5. file de correction : `GET /api/admin/corrections` + page
 *      `/admin/corrections` (« Demandes de Correction ») ;
 *   6. gestion utilisateurs : rôle, blocage avec `banReason` puis déblocage
 *      (bug #76 corrigé : `banned`/`banReason`/`banExpires` propagés, sessions
 *      révoquées) — le compte est restauré ACTIVE dans le même test ;
 *   7. journal/audit : `GET /api/admin/attestations/[id]/audit` et
 *      `GET /api/users/[id]/audit-logs` répondent 200 avec un tableau.
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./support/auth";
import { getIssuedCertification } from "./support/database";
import { CANDIDATE_EMAIL } from "./setup/env";

test.describe("Parcours admin de bout en bout (#140)", () => {
  test("1. l'admin se connecte par mot de passe et atteint son tableau de bord (#230)", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await expect(
      page.getByRole("heading", { name: "Bonjour Admin," }),
    ).toBeVisible();
    // Sous-titre réel de `app/admin/dashboard/page.tsx` (l'ancien libellé
    // « Bienvenue sur la console de gestion… » a disparu du design system :
    // l'assertion doit suivre l'interface livrée, pas un texte périmé).
    await expect(
      page.getByText("Vue d'ensemble des attestations, examens et inscriptions."),
    ).toBeVisible();
  });

  test("2. l'admin consulte l'attestation émise par le flux candidat", async ({
    page,
  }) => {
    const cert = await getIssuedCertification();
    expect(
      cert,
      "Le parcours candidat (projet chromium) doit avoir émis une attestation avant ce test.",
    ).not.toBeNull();

    await loginAsAdmin(page);
    await page.goto(`/admin/attestations/${cert!.id}`);

    // Le code de l'attestation est affiché (page détail) et le statut est
    // « Validée » (émise par le flux applicatif, pas encore révoquée).
    await expect(page.getByText(cert!.code).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Validée").first()).toBeVisible();
  });

  test("3. l'admin révoque l'attestation avec un motif obligatoire", async ({
    page,
  }) => {
    const cert = await getIssuedCertification();
    expect(
      cert,
      "Le parcours candidat (projet chromium) doit avoir émis une attestation avant ce test.",
    ).not.toBeNull();

    await loginAsAdmin(page);
    await page.goto(`/admin/attestations/${cert!.id}`);

    // Le bouton de révocation n'apparaît que si l'attestation n'est pas déjà
    // REJECTED (le test 3 est le seul à révoquer, la suite est séquentielle).
    await page.getByRole("button", { name: "Révoquer l'attestation" }).click();

    // Motif obligatoire (>= 5 caractères) : le bouton de confirmation est
    // désactivé tant que le motif est trop court.
    const confirmButton = page.getByRole("button", {
      name: "Confirmer la Révocation",
    });
    await expect(confirmButton).toBeDisabled();
    await page
      .getByPlaceholder(/Erreur de saisie/)
      .fill("Test E2E #140 : révocation volontaire de l'attestation");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // L'action met à jour l'état en place (setData) : le badge passe à
    // « Révoquée » (statut REJECTED) sans rechargement.
    await expect(page.getByText("Révoquée").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("4. l'admin crée une formation puis un examen DRAFT à 3 parties", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stamp = Date.now();
    const formationName = `[E2E #140] Formation admin ${stamp}`;

    // La page de création existe et porte son titre réel.
    await page.goto("/admin/formations/new");
    await expect(
      page.getByRole("heading", { name: "Nouvelle Formation" }),
    ).toBeVisible();

    // Création par la route réelle (`POST /api/formations`, 201).
    const formationResponse = await page.request.post("/api/formations", {
      data: {
        name: formationName,
        category: "Pisciculture",
        description: "Formation créée par le parcours admin E2E (#140).",
        skills: ["Suivi d'élevage"],
      },
    });
    expect(
      formationResponse.status(),
      `création formation refusée : ${await formationResponse.text()}`,
    ).toBe(201);
    const formation = (await formationResponse.json()) as { id: string };
    expect(formation.id).toBeTruthy();

    // La formation apparaît dans la liste.
    const listResponse = await page.request.get(
      `/api/formations?search=${encodeURIComponent(formationName)}`,
    );
    expect(listResponse.status()).toBe(200);
    const formations = (await listResponse.json()) as Array<{ name: string }>;
    expect(formations.some((f) => f.name === formationName)).toBe(true);

    // La page de création d'examen existe (titre réel de
    // `app/admin/exams/new/page.tsx`).
    await page.goto("/admin/exams/new");
    await expect(
      page.getByRole("heading", { name: "Créer un Nouvel Examen" }),
    ).toBeVisible();

    // `POST /api/exams` exige exactement 3 parties (min 3, max 3) : on crée
    // un examen DRAFT minimal (QCM + question ouverte + étude de cas).
    const examTitle = `[E2E #140] Examen admin ${stamp}`;
    const examResponse = await page.request.post("/api/exams", {
      data: {
        title: examTitle,
        description: "Examen DRAFT créé par le parcours admin E2E (#140).",
        status: "DRAFT",
        type: "OFFICIAL",
        parts: [
          { title: "QCM", type: "QCM", duration: 30, points: 20, order: 1 },
          { title: "Ouvert", type: "OPEN", duration: 30, points: 20, order: 2 },
          {
            title: "Cas pratique",
            type: "CASE_STUDY",
            duration: 30,
            points: 20,
            order: 3,
          },
        ],
      },
    });
    expect(
      examResponse.status(),
      `création examen refusée : ${await examResponse.text()}`,
    ).toBe(201);
    const exam = (await examResponse.json()) as { id: string };
    expect(exam.id).toBeTruthy();

    // L'examen apparaît dans la liste admin.
    const examsResponse = await page.request.get("/api/exams");
    expect(examsResponse.status()).toBe(200);
    const exams = (await examsResponse.json()) as Array<{ title: string }>;
    expect(exams.some((e) => e.title === examTitle)).toBe(true);
  });

  test("5. l'admin consulte la file des demandes de correction", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // L'endpoint admin répond 200 avec un tableau (vide si aucune demande).
    const correctionsResponse = await page.request.get(
      "/api/admin/corrections",
    );
    expect(correctionsResponse.status()).toBe(200);
    const corrections = await correctionsResponse.json();
    expect(Array.isArray(corrections)).toBe(true);

    // La page admin rend son titre réel et ne reste pas en erreur.
    await page.goto("/admin/corrections");
    await expect(
      page.getByRole("heading", { name: "Demandes de Correction" }),
    ).toBeVisible();
  });

  test("6. l'admin change le rôle puis bloque/débloque un compte (banReason)", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Résolution de l'identifiant via la recherche admin (`q` filtre aussi
    // sur l'email — cf. `app/api/users/route.ts`).
    const searchResponse = await page.request.get(
      `/api/users?q=${encodeURIComponent(CANDIDATE_EMAIL)}`,
    );
    expect(searchResponse.status()).toBe(200);
    const searchBody = (await searchResponse.json()) as {
      items: Array<{ id: string; email: string; role: string; status: string }>;
    };
    const candidate = searchBody.items.find(
      (u) => u.email === CANDIDATE_EMAIL,
    );
    expect(candidate, "candidat semé introuvable via /api/users").toBeTruthy();
    const userId = candidate!.id;

    // Changement de rôle (no-op `user` → `user` : prouve la route sans
    // risquer une élévation de privilèges persistante).
    const roleResponse = await page.request.patch(`/api/users/${userId}`, {
      data: { role: "user" },
    });
    expect(
      roleResponse.status(),
      `changement de rôle refusé : ${await roleResponse.text()}`,
    ).toBe(200);
    expect(
      ((await roleResponse.json()) as { role: string }).role,
    ).toBe("user");

    // Blocage avec motif obligatoire (#76 corrigé : `banned`/`banReason`
    // propagés, sessions révoquées).
    const blockResponse = await page.request.patch(`/api/users/${userId}`, {
      data: {
        status: "BLOCKED",
        banReason: "Test E2E #140 : blocage volontaire temporaire",
      },
    });
    expect(
      blockResponse.status(),
      `blocage refusé : ${await blockResponse.text()}`,
    ).toBe(200);

    // Déblocage immédiat : le compte candidat est restauré ACTIVE dans le
    // même test pour ne jamais laisser la suite dans un état bloqué.
    const unblockResponse = await page.request.patch(`/api/users/${userId}`, {
      data: { status: "ACTIVE" },
    });
    expect(
      unblockResponse.status(),
      `déblocage refusé : ${await unblockResponse.text()}`,
    ).toBe(200);
    expect(
      ((await unblockResponse.json()) as { status: string }).status,
    ).toBe("ACTIVE");
  });

  test("7. l'admin consulte le journal d'audit", async ({ page }) => {
    const cert = await getIssuedCertification();
    expect(
      cert,
      "Le parcours candidat (projet chromium) doit avoir émis une attestation avant ce test.",
    ).not.toBeNull();

    await loginAsAdmin(page);

    // Journal propre à l'attestation (révocation du test 3 tracée) : 200 +
    // tableau, jamais une erreur ni un objet inattendu.
    const auditResponse = await page.request.get(
      `/api/admin/attestations/${cert!.id}/audit`,
    );
    expect(auditResponse.status()).toBe(200);
    const auditLogs = await auditResponse.json();
    expect(Array.isArray(auditLogs)).toBe(true);

    // Journal propre à l'utilisateur : le candidat semé est résolu comme au
    // test 6, la route d'audit répond 200 avec un tableau.
    const searchResponse = await page.request.get(
      `/api/users?q=${encodeURIComponent(CANDIDATE_EMAIL)}`,
    );
    expect(searchResponse.status()).toBe(200);
    const searchBody = (await searchResponse.json()) as {
      items: Array<{ id: string; email: string }>;
    };
    const candidate = searchBody.items.find(
      (u) => u.email === CANDIDATE_EMAIL,
    );
    expect(candidate).toBeTruthy();

    const userAuditResponse = await page.request.get(
      `/api/users/${candidate!.id}/audit-logs`,
    );
    expect(userAuditResponse.status()).toBe(200);
    expect(Array.isArray(await userAuditResponse.json())).toBe(true);
  });
});