import { expect, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CANDIDATE_EMAIL,
  CANDIDATE_PASSWORD,
} from "../setup/env";

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

/**
 * Connexion de l'administrateur semé via `/admin/login` (mot de passe
 * uniquement — cf. #230 : le compte admin seedé ne pouvait pas se connecter
 * tant que `accountId` valait l'email ; corrigé par la PR #234).
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");

  await expect(page.locator("#email")).toBeVisible();

  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  // callbackURL = /admin/dashboard (cf. app/admin/login/page.tsx).
  await page.waitForURL(/\/admin\/dashboard$/, { timeout: 60_000 });
}
