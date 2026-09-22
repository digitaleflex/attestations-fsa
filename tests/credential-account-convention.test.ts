import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression structurelle (issue #230).
 *
 * Better Auth 1.7 identifie un compte `credential` via `accountId === user.id`
 * (cf. better-auth/dist/api/routes/sign-in.mjs:316). Les six emplacements
 * d'écriture ci-dessous écrivaient auparavant l'e-mail comme accountId, ce qui
 * cassait la connexion mot de passe. Ce test échoue si l'un d'eux régresse.
 *
 * Aucune base de données n'est requise : lecture de fichiers uniquement.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Une affectation `accountId` ne doit jamais recevoir une valeur d'e-mail. */
const EMAIL_AS_ACCOUNT_ID = /accountId:\s*[^,\n}]*[Ee]mail/;

describe("Convention accountId des comptes credential (#230)", () => {
  it("app/api/admin/route.ts aligne accountId sur l'id utilisateur", () => {
    const source = read(path.join("app", "api", "admin", "route.ts"));
    expect(source).toMatch(/accountId:\s*currentUser\.id/);
    expect(source).not.toMatch(EMAIL_AS_ACCOUNT_ID);
  });

  it("app/api/users/route.ts crée le Account avec accountId = user.id", () => {
    const source = read(path.join("app", "api", "users", "route.ts"));
    expect(source).toMatch(/accountId:\s*user\.id/);
    expect(source).not.toMatch(/accountId:\s*sanitizedEmail/);
    expect(source).not.toMatch(EMAIL_AS_ACCOUNT_ID);
  });

  it("app/api/users/[id]/route.ts n'écrit pas l'e-mail comme accountId", () => {
    const source = read(path.join("app", "api", "users", "[id]", "route.ts"));
    expect(source).toMatch(/accountId:\s*id\b/);
    expect(source).not.toMatch(/accountId:\s*data\.email/);
    expect(source).not.toMatch(EMAIL_AS_ACCOUNT_ID);
  });

  it("scripts/create-admin.ts aligne accountId sur l'id utilisateur", () => {
    const source = read(path.join("scripts", "create-admin.ts"));
    expect(source).toMatch(/accountId:\s*user\.id/);
    expect(source).not.toMatch(/accountId:\s*admin\.email/);
    expect(source).not.toMatch(EMAIL_AS_ACCOUNT_ID);
  });

  it("scripts/create-demo-candidat.ts aligne accountId sur l'id utilisateur", () => {
    const source = read(path.join("scripts", "create-demo-candidat.ts"));
    expect(source).toMatch(/accountId:\s*user\.id/);
    expect(source).not.toMatch(EMAIL_AS_ACCOUNT_ID);
  });

  it("prisma/seed.ts crée l'admin via le helper idempotent, sans e-mail comme accountId", () => {
    const source = read(path.join("prisma", "seed.ts"));
    expect(source).not.toMatch(/accountId:\s*'admin@fsa\.bj'/);
    expect(source).not.toMatch(EMAIL_AS_ACCOUNT_ID);
    // Le bloc admin ET le bloc candidat passent par le helper.
    const helperCalls = source.match(/ensureCredentialAccount\(/g) ?? [];
    expect(helperCalls.length).toBeGreaterThanOrEqual(3);
  });

  it("aucun des six emplacements n'écrit plus l'e-mail comme accountId", () => {
    const files = [
      path.join("app", "api", "admin", "route.ts"),
      path.join("app", "api", "users", "route.ts"),
      path.join("app", "api", "users", "[id]", "route.ts"),
      path.join("scripts", "create-admin.ts"),
      path.join("scripts", "create-demo-candidat.ts"),
      path.join("prisma", "seed.ts"),
    ];

    for (const file of files) {
      const source = read(file);
      const offending = source
        .split("\n")
        .filter((line) => EMAIL_AS_ACCOUNT_ID.test(line));
      expect(offending, `${file} écrit un e-mail comme accountId`).toEqual([]);
    }
  });
});

describe("Garde-fous des scripts de réparation (#230)", () => {
  it("le script de réparation est dry-run par défaut et exige une confirmation", () => {
    const source = read(
      path.join("scripts", "fix-credential-accounts.ts"),
    );
    expect(source).toMatch(/--apply/);
    expect(source).toMatch(/--yes/);
    expect(source).toMatch(/process\.env\.VITEST/);
    // N'écrit que accountId + updatedAt : jamais le mot de passe.
    const applyBlock = source.slice(
      source.indexOf("export async function applyCredentialAccountRepairs"),
      source.indexOf("export type CliOptions"),
    );
    expect(applyBlock).not.toMatch(/password/);
  });

  it("le script d'audit est strictement en lecture seule", () => {
    const source = read(path.join("scripts", "audit-credential-accounts.ts"));
    expect(source).toMatch(/analyzeCredentialAccounts/);
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.create\(/);
    expect(source).not.toMatch(/\.delete/);
  });
});
