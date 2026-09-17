import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Aucune base n'est disponible : on mocke le client Prisma pour que le seed
// n'ouvre aucune connexion et pour neutraliser son exécution automatique.
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(async ({ where }: { where: { email: string } }) => ({
      id: where.email.startsWith("admin") ? "admin-id" : "candidate-id",
    })),
    create: vi.fn(async () => ({ id: "created-user-id" })),
  },
  account: {
    findFirst: vi.fn(async () => ({
      id: "acc-existing",
      accountId: "candidate-id",
      password: "hashed:existing",
    })),
    create: vi.fn(async () => ({ id: "acc-new" })),
    update: vi.fn(async () => ({ id: "acc-existing" })),
  },
  formation: {
    findFirst: vi.fn(async () => ({ id: "formation-1" })),
    create: vi.fn(async () => ({ id: "formation-new" })),
    update: vi.fn(async () => ({ id: "formation-1" })),
  },
  $disconnect: vi.fn(async () => undefined),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    user = prismaMock.user;
    account = prismaMock.account;
    formation = prismaMock.formation;
    $disconnect = prismaMock.$disconnect;
  },
}));

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

import {
  ensureCredentialAccount,
  type CredentialAccountClient,
} from "../prisma/seed";

type FakeAccountRow = {
  id: string;
  accountId: string;
  password: string | null;
};

function makeClient(initial: FakeAccountRow | null) {
  const account = {
    findFirst: vi.fn(async () => initial),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "acc-new",
      ...args.data,
    })),
    update: vi.fn(
      async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        ...args.data,
      }),
    ),
  };

  return { client: { account } as unknown as CredentialAccountClient, account };
}

describe("ensureCredentialAccount — Account credential seedé (#223)", () => {
  it("crée un Account credential dont accountId est l'id utilisateur", async () => {
    const { client, account } = makeClient(null);

    const state = await ensureCredentialAccount(client, {
      userId: "user-42",
      passwordHash: "hashed:pw",
    });

    expect(state).toBe("created");
    expect(account.create).toHaveBeenCalledTimes(1);
    expect(account.create).toHaveBeenCalledWith({
      data: {
        userId: "user-42",
        providerId: "credential",
        accountId: "user-42",
        password: "hashed:pw",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
    expect(account.update).not.toHaveBeenCalled();
  });

  it("est idempotent : un Account sain n'est ni recréé ni modifié", async () => {
    const { client, account } = makeClient({
      id: "acc-1",
      accountId: "user-42",
      password: "hashed:old",
    });

    const state = await ensureCredentialAccount(client, {
      userId: "user-42",
      passwordHash: "hashed:new",
    });

    expect(state).toBe("exists");
    expect(account.create).not.toHaveBeenCalled();
    expect(account.update).not.toHaveBeenCalled();
  });

  it("répare un accountId désaligné (email) sans créer de doublon", async () => {
    const { client, account } = makeClient({
      id: "acc-1",
      accountId: "candidat@example.com",
      password: "hashed:old",
    });

    const state = await ensureCredentialAccount(client, {
      userId: "user-42",
      passwordHash: "hashed:new",
    });

    expect(state).toBe("repaired");
    expect(account.create).not.toHaveBeenCalled();
    expect(account.update).toHaveBeenCalledTimes(1);
    expect(account.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: {
        accountId: "user-42",
        password: "hashed:new",
        updatedAt: expect.any(Date),
      },
    });
  });

  it("ne crée qu'un seul Account sur deux passages successifs", async () => {
    let stored: FakeAccountRow | null = null;
    const account = {
      findFirst: vi.fn(async () => stored),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        stored = {
          id: "acc-1",
          accountId: String(args.data.accountId),
          password: String(args.data.password),
        };
        return stored;
      }),
      update: vi.fn(
        async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          stored = {
            id: args.where.id,
            accountId: String(args.data.accountId),
            password: String(args.data.password),
          };
          return stored;
        },
      ),
    };
    const client = { account } as unknown as CredentialAccountClient;

    const first = await ensureCredentialAccount(client, {
      userId: "user-42",
      passwordHash: "hashed:pw",
    });
    const second = await ensureCredentialAccount(client, {
      userId: "user-42",
      passwordHash: "hashed:pw",
    });

    expect(first).toBe("created");
    expect(second).toBe("exists");
    expect(account.create).toHaveBeenCalledTimes(1);
    expect(account.update).not.toHaveBeenCalled();
  });
});

describe("prisma/seed.ts — garde anti-régression structurelle (#223)", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "prisma", "seed.ts"),
    "utf8",
  );

  it("le bloc candidat crée bien son Account credential", () => {
    const start = source.indexOf("// Créer un utilisateur de test (candidat)");
    const end = source.indexOf("// Seeder les formations");

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const candidateBlock = source.slice(start, end);
    expect(candidateBlock).toContain("ensureCredentialAccount");
    expect(candidateBlock).not.toMatch(/accountId:\s*candidateEmail/);
    expect(candidateBlock).not.toMatch(/accountId:\s*'candidat@example\.com'/);
  });

  it("le helper construit accountId à partir de l'id utilisateur", () => {
    expect(source).toMatch(/providerId:\s*'credential'/);
    expect(source).toMatch(/accountId:\s*params\.userId/);
  });
});
