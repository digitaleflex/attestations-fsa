import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  storedObject: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

import {
  StorageOwnershipError,
  StorageValidationError,
  StoredObjectNotFoundError,
  StoredObjectProtectedError,
  assertPurgeAllowed,
  assertOwnership,
  assertStorableKey,
  computeChecksum,
  isOfficialStoredObject,
  registerStoredObject,
  requireOwnedObject,
  unregisterStoredObject,
} from "./registry";

const CHECKSUM = "a".repeat(64);

function object(overrides: Record<string, unknown> = {}) {
  return {
    id: "obj-1",
    key: "cv/abcdefghijkl.pdf",
    ownerUserId: "user-1",
    purpose: "cv",
    linkedEntityType: null,
    linkedEntityId: null,
    checksum: CHECKSUM,
    sizeBytes: 10,
    contentType: "application/pdf",
    retentionUntil: null,
    createdAt: new Date("2026-09-26T00:00:00.000Z"),
    updatedAt: new Date("2026-09-26T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.storedObject.upsert.mockResolvedValue(object());
  db.storedObject.deleteMany.mockResolvedValue({ count: 1 });
});

describe("empreinte de contenu (#260)", () => {
  it("calcule un SHA-256 hexadécimal stable", () => {
    const first = computeChecksum(Buffer.from("fsa"));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(computeChecksum(Buffer.from("fsa"))).toBe(first);
    expect(computeChecksum(Buffer.from("autre"))).not.toBe(first);
  });
});

describe("assertStorableKey", () => {
  it("accepte les clés des préfixes autorisés", () => {
    expect(assertStorableKey("cv/abcdefghijkl.pdf")).toBe("cv/abcdefghijkl.pdf");
    expect(assertStorableKey("stages/abcdefghijkl.pdf")).toBe("stages/abcdefghijkl.pdf");
  });

  it("refuse une URL signée et une clé hors préfixes", () => {
    expect(() =>
      assertStorableKey("cv/abcdefghijkl.pdf?X-Amz-Signature=abc"),
    ).toThrow(StorageValidationError);
    expect(() => assertStorableKey("https://bucket.test/cv/a.pdf")).toThrow();
    expect(() => assertStorableKey("images/abcdefghijkl.pdf")).toThrow(/préfixes autorisés/);
    expect(() => assertStorableKey("../cv/abcdefghijkl.pdf")).toThrow();
  });
});

describe("propriété (#260)", () => {
  it("autorise le propriétaire", () => {
    expect(() => assertOwnership(object(), { userId: "user-1", isAdmin: false })).not.toThrow();
  });

  it("refuse un autre utilisateur", () => {
    expect(() => assertOwnership(object(), { userId: "user-2", isAdmin: false })).toThrow(
      StorageOwnershipError,
    );
  });

  it("refuse un objet sans propriétaire pour un non-admin", () => {
    expect(() =>
      assertOwnership(object({ ownerUserId: null }), { userId: "user-1", isAdmin: false }),
    ).toThrow(StorageOwnershipError);
  });

  it("laisse passer l'administrateur", () => {
    expect(() =>
      assertOwnership(object({ ownerUserId: null }), { userId: "admin-1", isAdmin: true }),
    ).not.toThrow();
  });

  it("refuse un acteur non authentifié", () => {
    expect(() => assertOwnership(object(), { userId: null, isAdmin: false })).toThrow(
      StorageOwnershipError,
    );
  });

  it("requireOwnedObject lève 404 sur un objet non enregistré", async () => {
    db.storedObject.findUnique.mockResolvedValue(null);
    await expect(
      requireOwnedObject("cv/abcdefghijkl.pdf", { userId: "user-1", isAdmin: false }),
    ).rejects.toBeInstanceOf(StoredObjectNotFoundError);
  });

  it("requireOwnedObject refuse un objet appartenant à autrui", async () => {
    db.storedObject.findUnique.mockResolvedValue(object({ ownerUserId: "user-2" }));
    await expect(
      requireOwnedObject("cv/abcdefghijkl.pdf", { userId: "user-1", isAdmin: false }),
    ).rejects.toBeInstanceOf(StorageOwnershipError);
  });

  it("requireOwnedObject renvoie l'objet au propriétaire", async () => {
    db.storedObject.findUnique.mockResolvedValue(object());
    const found = await requireOwnedObject("cv/abcdefghijkl.pdf", {
      userId: "user-1",
      isAdmin: false,
    });
    expect(found.key).toBe("cv/abcdefghijkl.pdf");
  });
});

describe("protection des PDF officiels (#260)", () => {
  it("reconnaît un objet officiel par usage ou par préfixe", () => {
    expect(isOfficialStoredObject(object({ purpose: "attestation" }))).toBe(true);
    expect(
      isOfficialStoredObject(object({ purpose: "cv", key: "attestations/FSA-2026/v1.pdf" })),
    ).toBe(true);
    expect(isOfficialStoredObject(object())).toBe(false);
  });

  it("interdit la suppression d'un PDF officiel", () => {
    expect(() => assertPurgeAllowed(object({ purpose: "attestation" }))).toThrow(
      StoredObjectProtectedError,
    );
    expect(() =>
      assertPurgeAllowed(object({ purpose: "cv", key: "attestations/FSA-2026/v1.pdf" })),
    ).toThrow(StoredObjectProtectedError);
  });

  it("autorise la suppression d'un objet ordinaire", () => {
    expect(() => assertPurgeAllowed(object())).not.toThrow();
    expect(() => assertPurgeAllowed(object({ purpose: "temporary" }))).not.toThrow();
  });
});

describe("registerStoredObject", () => {
  it("enregistre la clé stable, le propriétaire et l'empreinte", async () => {
    await registerStoredObject({
      key: "stages/abcdefghijkl.pdf",
      ownerUserId: null,
      purpose: "internship",
      linkedEntityType: "InternshipRequest",
      linkedEntityId: "intern-1",
      checksum: CHECKSUM,
      sizeBytes: 12,
      contentType: "application/pdf",
    });
    expect(db.storedObject.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "stages/abcdefghijkl.pdf" } }),
    );
    const payload = db.storedObject.upsert.mock.calls[0][0];
    expect(payload.create).toMatchObject({
      key: "stages/abcdefghijkl.pdf",
      ownerUserId: null,
      purpose: "internship",
      linkedEntityId: "intern-1",
      checksum: CHECKSUM,
    });
    // Aucune URL signée n'est stockée : uniquement la clé.
    expect(JSON.stringify(payload)).not.toContain("X-Amz");
  });

  it("refuse une clé invalide ou une empreinte absente", async () => {
    await expect(
      registerStoredObject({ key: "images/x.pdf", purpose: "cv", checksum: CHECKSUM }),
    ).rejects.toBeInstanceOf(StorageValidationError);
    await expect(
      registerStoredObject({ key: "cv/abcdefghijkl.pdf", purpose: "cv", checksum: "abc" }),
    ).rejects.toBeInstanceOf(StorageValidationError);
    expect(db.storedObject.upsert).not.toHaveBeenCalled();
  });
});

describe("unregisterStoredObject", () => {
  it("retire la ligne du registre", async () => {
    await unregisterStoredObject("cv/abcdefghijkl.pdf");
    expect(db.storedObject.deleteMany).toHaveBeenCalledWith({
      where: { key: "cv/abcdefghijkl.pdf" },
    });
  });
});
