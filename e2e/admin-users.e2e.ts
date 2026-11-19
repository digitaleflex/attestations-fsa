import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./support/auth";

test("admin users: navigation, filtres, tri, pagination, CRUD", async ({ page }) => {
  await loginAsAdmin(page);

  // 1. Navigation vers /admin/users et affichage de la page
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Apprenants" }).first()).toBeVisible();
  await expect(page.locator("#users-search")).toBeVisible();

  // 2. Recherche par nom (filtrer les résultats)
  await page.locator("#users-search").fill("Jean Koffi");
  await expect(page.getByText("Jean Koffi")).toBeVisible({ timeout: 10_000 });

  await page.locator("#users-search").fill("");
  await page.waitForTimeout(600);

  // 3. Filtre par statut (ACTIVE/BLOCKED)
  await page.getByLabel("Statut").click();
  await page.getByRole("option", { name: "Actif" }).click();
  await expect(page.getByText("Jean Koffi")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Statut").click();
  await page.getByRole("option", { name: "Tous" }).click();

  // 4. Filtre par rôle (admin/user)
  await page.getByLabel("Rôle").click();
  await page.getByRole("option", { name: "Administrateur" }).click();
  await expect(page.getByText("Administrateur FSA")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Rôle").click();
  await page.getByRole("option", { name: "Tous" }).click();

  // 5. Filtre par vérification (vérifié/non vérifié)
  await page.getByLabel("Vérification").click();
  await page.getByRole("option", { name: "Vérifié" }).click();
  await expect(page.getByText("Jean Koffi")).toBeVisible({ timeout: 10_000 });

  await page.getByLabel("Vérification").click();
  await page.getByRole("option", { name: "Tous" }).click();

  // 6. Tri par nom
  await page.getByRole("button", { name: /Trier par Nom/i }).click();
  await expect(page.getByRole("button", { name: /Trier par Nom/i })).toBeVisible();

  // 7. Pagination (si plus de 20 utilisateurs) — on crée 22 utilisateurs via l'API
  for (let i = 0; i < 22; i++) {
    const res = await page.request.post("/api/users", {
      data: {
        name: `Pagination User ${i}`,
        email: `pagination-user-${i}-${Date.now()}@example.com`,
        password: "Pagination123!",
        role: "user",
      },
    });
    expect(res.ok()).toBeTruthy();
  }

  await page.goto("/admin/users");
  await expect(page.getByText(/Page 1 sur/i)).toBeVisible({ timeout: 10_000 });
  const nextBtn = page.getByRole("button", { name: "Page suivante" });
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();
  await expect(page.getByText(/Page 2 sur/i)).toBeVisible({ timeout: 10_000 });

  // 8. Création d'un utilisateur (via le dialog)
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Ajouter un apprenant" }).first().click();
  await expect(page.getByRole("heading", { name: "Nouvel utilisateur" })).toBeVisible();

  const createdEmail = `e2e-created-${Date.now()}@example.com`;
  await page.locator("#name").fill("Utilisateur Cree E2E");
  await page.locator("#email").fill(createdEmail);
  await page.locator("#password").fill("Created123!");
  await page.locator("#role").selectOption("user");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Utilisateur créé")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Utilisateur Cree E2E")).toBeVisible({ timeout: 10_000 });

  // 9. Suspension / réactivation d'un utilisateur
  const userMenu = page.getByRole("button", { name: "Actions pour Utilisateur Cree E2E" });
  await userMenu.click();
  await page.getByRole("menuitem", { name: "Suspendre" }).click();
  await expect(page.getByText("Utilisateur suspendu")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Actions pour Utilisateur Cree E2E" }).click();
  await page.getByRole("menuitem", { name: "Réactiver" }).click();
  await expect(page.getByText("Utilisateur réactivé")).toBeVisible({ timeout: 10_000 });

  // 10. Suppression d'un utilisateur (avec confirmation email pour admin)
  await page.getByRole("button", { name: "Ajouter un apprenant" }).first().click();
  await expect(page.getByRole("heading", { name: "Nouvel utilisateur" })).toBeVisible();

  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  await page.locator("#name").fill("Admin Suppression E2E");
  await page.locator("#email").fill(adminEmail);
  await page.locator("#password").fill("AdminDel123!");
  await page.locator("#role").selectOption("admin");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Utilisateur créé")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Admin Suppression E2E")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Actions pour Admin Suppression E2E" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();

  await expect(page.getByText("Supprimer cet utilisateur ?")).toBeVisible({ timeout: 10_000 });
  await page.locator("#delete-confirm-email").fill(adminEmail);
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Utilisateur supprimé")).toBeVisible({ timeout: 10_000 });
});
