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
 */
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./support/auth";
import { getIssuedCertification } from "./support/database";

test.describe("Parcours admin de bout en bout (#140)", () => {
  test("1. l'admin se connecte par mot de passe et atteint son tableau de bord (#230)", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await expect(
      page.getByRole("heading", { name: "Bonjour Admin," }),
    ).toBeVisible();
    await expect(
      page.getByText("Bienvenue sur la console de gestion des attestations et des examens."),
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
});