import { describe, it, expect } from "vitest";
import {
  planCredentialAccountRepairs,
  applyCredentialAccountRepairs,
  parseArgs,
  type CredentialAccountRow,
  type CredentialAccountStore,
} from "../../scripts/fix-credential-accounts";
import { analyzeCredentialAccounts } from "../../scripts/audit-credential-accounts";

/**
 * Tests de la logique pure des scripts #230 — AUCUNE base de données.
 * Le client Prisma est remplacé par un faux store en mémoire.
 */

function row(
  partial: Pick<CredentialAccountRow, "id" | "userId" | "accountId"> &
    Partial<CredentialAccountRow>,
): CredentialAccountRow {
  return {
    password: "hashed:pw",
    user: { email: `${partial.userId}@example.com` },
    ...partial,
  };
}

function makeStore(rows: CredentialAccountRow[]) {
  const updates: Array<{
    where: { id: string };
    data: { accountId: string; updatedAt: Date };
  }> = [];

  const store: CredentialAccountStore = {
    account: {
      findMany: async () => rows,
      update: async (args) => {
        updates.push(args);
        const target = rows.find((r) => r.id === args.where.id);
        if (target) target.accountId = args.data.accountId;
        return { id: args.where.id };
      },
    },
  };

  return { store, updates, rows };
}

describe("planCredentialAccountRepairs (#230)", () => {
  it("ne prévoit rien quand tous les comptes sont alignés (idempotence)", () => {
    const plan = planCredentialAccountRepairs([
      row({ id: "a1", userId: "u1", accountId: "u1" }),
      row({ id: "a2", userId: "u2", accountId: "u2" }),
    ]);

    expect(plan.toRepair).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.decisions).toEqual([]);
  });

  it("répare un accountId = email en le réalignant sur userId", () => {
    const plan = planCredentialAccountRepairs([
      row({ id: "a1", userId: "u1", accountId: "candidat@example.com" }),
    ]);

    expect(plan.toRepair).toHaveLength(1);
    expect(plan.toRepair[0]).toMatchObject({
      action: "repair",
      rowId: "a1",
      userId: "u1",
      currentAccountId: "candidat@example.com",
      targetAccountId: "u1",
    });
  });

  it("signale mais ne répare jamais un compte sans mot de passe", () => {
    const plan = planCredentialAccountRepairs([
      row({
        id: "a1",
        userId: "u1",
        accountId: "candidat@example.com",
        password: null,
      }),
    ]);

    expect(plan.toRepair).toEqual([]);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].action).toBe("skip-no-password");
  });

  it("signale un conflit si un autre compte credential occupe déjà userId", () => {
    const plan = planCredentialAccountRepairs([
      row({ id: "a1", userId: "u1", accountId: "u1" }),
      row({ id: "a2", userId: "u1", accountId: "old@example.com" }),
    ]);

    expect(plan.toRepair).toEqual([]);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]).toMatchObject({
      action: "skip-conflict",
      rowId: "a2",
    });
  });

  it("ne réaligne qu'un seul compte quand plusieurs sont désalignés (contrainte unique)", () => {
    const plan = planCredentialAccountRepairs([
      row({ id: "a1", userId: "u1", accountId: "old1@example.com" }),
      row({ id: "a2", userId: "u1", accountId: "old2@example.com" }),
    ]);

    expect(plan.toRepair).toHaveLength(1);
    expect(plan.toRepair[0].rowId).toBe("a1"); // ordre déterministe par id
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0].action).toBe("skip-conflict");
  });

  it("le plan devient vide après application (idempotence bout en bout)", async () => {
    const rows = [
      row({ id: "a1", userId: "u1", accountId: "candidat@example.com" }),
    ];
    const { store } = makeStore(rows);

    const first = planCredentialAccountRepairs(rows);
    const result = await applyCredentialAccountRepairs(store, first);
    expect(result.repaired).toEqual(["a1"]);
    expect(result.failed).toEqual([]);

    const second = planCredentialAccountRepairs(rows);
    expect(second.toRepair).toEqual([]);
  });
});

describe("applyCredentialAccountRepairs (#230)", () => {
  it("n'écrit que accountId + updatedAt, jamais le mot de passe", async () => {
    const rows = [row({ id: "a1", userId: "u1", accountId: "x@y.z" })];
    const { store, updates } = makeStore(rows);

    await applyCredentialAccountRepairs(
      store,
      planCredentialAccountRepairs(rows),
    );

    expect(updates).toHaveLength(1);
    expect(Object.keys(updates[0].data).sort()).toEqual([
      "accountId",
      "updatedAt",
    ]);
    expect(JSON.stringify(updates[0])).not.toMatch(/password/i);
  });

  it("isole les échecs : une écriture ratée n'annule pas les autres", async () => {
    const failingStore: CredentialAccountStore = {
      account: {
        findMany: async () => [],
        update: async (args) => {
          if (args.where.id === "a1") throw new Error("unique constraint");
          return {};
        },
      },
    };

    const decision = (rowId: string) => ({
      action: "repair" as const,
      rowId,
      userId: rowId,
      userEmail: null,
      currentAccountId: "old@example.com",
      targetAccountId: rowId,
      reason: "test",
    });

    const result = await applyCredentialAccountRepairs(failingStore, {
      decisions: [decision("a1"), decision("a2")],
      toRepair: [decision("a1"), decision("a2")],
      skipped: [],
    });

    expect(result.repaired).toEqual(["a2"]);
    expect(result.failed).toEqual([
      { rowId: "a1", error: "unique constraint" },
    ]);
  });
});

describe("parseArgs (#230)", () => {
  it("est en dry-run par défaut", () => {
    expect(parseArgs([])).toEqual({ apply: false, yes: false });
  });

  it("accepte --apply --yes", () => {
    expect(parseArgs(["--apply", "--yes"])).toEqual({
      apply: true,
      yes: true,
    });
  });

  it("--dry-run annule un --apply précédent", () => {
    expect(parseArgs(["--apply", "--dry-run"])).toEqual({
      apply: false,
      yes: false,
    });
  });

  it("refuse une option inconnue", () => {
    expect(() => parseArgs(["--force"])).toThrow(/inconnue/);
  });
});

describe("analyzeCredentialAccounts (#230)", () => {
  it("compte les alignés et les désalignés, avec/sans mot de passe", () => {
    const report = analyzeCredentialAccounts([
      row({ id: "a1", userId: "u1", accountId: "u1" }),
      row({ id: "a2", userId: "u2", accountId: "bob@example.com" }),
      row({
        id: "a3",
        userId: "u3",
        accountId: "carol@example.com",
        password: null,
      }),
    ]);

    expect(report.total).toBe(3);
    expect(report.aligned).toBe(1);
    expect(report.misaligned.map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(report.misalignedWithPassword.map((a) => a.id)).toEqual(["a2"]);
    expect(report.misalignedWithoutPassword.map((a) => a.id)).toEqual(["a3"]);
  });

  it("détecte un utilisateur avec plusieurs comptes credential", () => {
    const report = analyzeCredentialAccounts([
      row({ id: "a1", userId: "u1", accountId: "u1" }),
      row({ id: "a2", userId: "u1", accountId: "old@example.com" }),
    ]);

    expect(report.usersWithMultipleCredentialAccounts).toHaveLength(1);
    expect(report.usersWithMultipleCredentialAccounts[0].accountIds).toEqual([
      "u1",
      "old@example.com",
    ]);
  });
});
