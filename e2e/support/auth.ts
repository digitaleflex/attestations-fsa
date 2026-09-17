import { expect, type Page } from "@playwright/test";
import { CANDIDATE_EMAIL, CANDIDATE_PASSWORD } from "../setup/env";

/**
 * Connexion du candidat semé via l'interface réelle (`/auth`), onglet
 * « Mot de passe » (sélectionné par défaut). Aucun cookie n'est injecté
 * en douce : la session est bien obtenue par le flux Better Auth.
 */
export async function loginAsCandidate(page: Page): Promise<void> {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();

  await page.locator("#email").fill(CANDIDATE_EMAIL);
  await page.locator("#password").fill(CANDIDATE_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  // next dev : la première compilation d'une route peut dépasser 30 s.
  await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
}
