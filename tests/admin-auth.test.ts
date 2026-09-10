import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// NOTE: les mocks doivent être déclarés avant l'import de @/lib/auth
// car lib/auth importe rawPrisma (connexion DB) et next/headers (runtime Next).
vi.mock("@/lib/prisma", () => ({
  rawPrisma: {},
  prisma: {},
  default: {},
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { auth, getAdminUser, getCurrentUser } from "@/lib/auth";

function makeRequest(): Request {
  return { headers: new Headers() } as Request;
}

describe("getAdminUser - role-based admin check (no hardcoded IDs)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne l'utilisateur quand le rôle est ADMIN (majuscules)", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: "test-user-id",
        email: "admin@example.com",
        name: "Test Admin",
        role: "ADMIN",
        emailVerified: new Date(),
      },
    } as any);

    const result = await getAdminUser(makeRequest());
    expect(result).not.toBeNull();
    expect(result?.email).toBe("admin@example.com");
    expect(result?.role).toBe("admin");
  });

  it("retourne l'utilisateur quand le rôle est admin (minuscules, insensible à la casse)", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: "test-user-id",
        email: "admin2@example.com",
        name: "Test Admin",
        role: "admin",
        emailVerified: new Date(),
      },
    } as any);

    const result = await getAdminUser(makeRequest());
    expect(result).not.toBeNull();
    expect(result?.email).toBe("admin2@example.com");
  });

  it("retourne null quand le rôle est USER", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: "test-user-id-2",
        email: "user@example.com",
        name: "Test User",
        role: "USER",
        emailVerified: new Date(),
      },
    } as any);

    const result = await getAdminUser(makeRequest());
    expect(result).toBeNull();
  });

  it("retourne null quand aucun rôle (utilisateur standard sans rôle)", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: "test-user-id-3",
        email: "norole@example.com",
        name: "No Role",
        emailVerified: new Date(),
      },
    } as any);

    const result = await getAdminUser(makeRequest());
    expect(result).toBeNull();
  });

  it("retourne null quand aucune session", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue(null as any);

    const result = await getAdminUser(makeRequest());
    expect(result).toBeNull();
  });

  it("retourne null quand getSession lève une erreur", async () => {
    vi.spyOn(auth.api, "getSession").mockRejectedValue(new Error("DB down"));

    const result = await getAdminUser(makeRequest());
    expect(result).toBeNull();
  });
});

describe("getCurrentUser - vérifie que les UUID admin sont supprimés", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne l'utilisateur avec le rôle depuis la session", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "ADMIN",
        emailVerified: new Date(),
      },
    } as any);

    const result = await getCurrentUser(makeRequest());
    expect(result).not.toBeNull();
    expect(result?.role).toBe("ADMIN");
  });

  it("retourne null sans session", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue(null as any);

    const result = await getCurrentUser(makeRequest());
    expect(result).toBeNull();
  });
});

describe("régression - aucun UUID admin codé en dur dans lib/auth.ts", () => {
  const KNOWN_LEGACY_IDS = [
    "12e53c70-d896-4859-bba4-6dd8ebb86f9f",
    "825e0264-68ac-4a37-a5bd-e326249d96c5",
    "d50f9baf-4872-4a2c-8f67-01c1965954b8",
  ];

  it("ne contient aucun des anciens UUID codés en dur", () => {
    const authPath = path.resolve(__dirname, "../lib/auth.ts");
    const content = fs.readFileSync(authPath, "utf8");
    for (const id of KNOWN_LEGACY_IDS) {
      expect(content).not.toContain(id);
    }
  });

  it("charge les IDs admin depuis ADMIN_USER_IDS", () => {
    const authPath = path.resolve(__dirname, "../lib/auth.ts");
    const content = fs.readFileSync(authPath, "utf8");
    expect(content).toContain("ADMIN_USER_IDS");
  });
});
