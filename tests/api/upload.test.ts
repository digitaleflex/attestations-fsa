import { vi, describe, it, expect, beforeEach } from "vitest";

const authDeps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: authDeps.getCurrentUser,
  getAdminUser: authDeps.getAdminUser,
}));

// La route délègue l'écriture à l'abstraction `lib/storage` : on mocke
// uniquement `getStorage` (driver), le reste (buildObjectKey,
// validateUpload, registre `StoredObject`) reste réel.
const store = vi.hoisted(() => ({
  put: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
  exists: vi.fn(async () => true),
  getSignedUrl: vi.fn(async (key: string) => `/uploads/${key}`),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, getStorage: () => store };
});

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { storedObject: { findUnique: db.findUnique, upsert: db.upsert, deleteMany: db.deleteMany } },
}));

vi.mock("nanoid", () => ({ nanoid: () => "abcdefghijkl" }));

import { POST, DELETE } from "../../app/api/upload/route";

const CHECKSUM = "a".repeat(64);

interface FakeFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function makeFile(overrides: Partial<FakeFile> = {}): FakeFile {
  // Magic bytes réels : validateUpload (lib/storage) vérifie le contenu,
  // pas seulement le type déclaré.
  const magicByType: Record<string, Uint8Array> = {
    "application/pdf": new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
    "image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  };
  const type = overrides.type ?? "application/pdf";
  const bytes = magicByType[type] ?? new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  return {
    name: "cv.pdf",
    type: "application/pdf",
    size: 1234,
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
    ...overrides,
  };
}

function makeUploadRequest(
  file: FakeFile | null,
  fields: Record<string, string> = {},
) {
  return {
    formData: async () => ({
      get: (key: string) => {
        if (key === "file") return file;
        return fields[key] ?? null;
      },
    }),
    headers: { get: () => null },
  } as unknown as Request;
}

function makeDeleteRequest(key: string) {
  return {
    nextUrl: { searchParams: new URLSearchParams(key ? { key } : {}) },
  } as unknown as Request;
}

function storedObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "obj-1",
    key: "cv/abcdefghijkl.pdf",
    ownerUserId: "user-1",
    purpose: "cv",
    linkedEntityType: null,
    linkedEntityId: null,
    checksum: CHECKSUM,
    sizeBytes: 8,
    contentType: "application/pdf",
    retentionUntil: null,
    createdAt: new Date("2026-09-26T00:00:00.000Z"),
    updatedAt: new Date("2026-09-26T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authDeps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  authDeps.getAdminUser.mockResolvedValue(null as never);
  store.put.mockResolvedValue(undefined as never);
  store.delete.mockResolvedValue(undefined as never);
  store.getSignedUrl.mockImplementation(async (key: string) => `/uploads/${key}`);
  db.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) =>
    storedObject(create as Record<string, unknown>),
  );
  db.findUnique.mockResolvedValue(storedObject() as never);
  db.deleteMany.mockResolvedValue({ count: 1 } as never);
});

describe("POST /api/upload", () => {
  it("401 si ni utilisateur ni admin", async () => {
    authDeps.getCurrentUser.mockResolvedValue(null as never);
    authDeps.getAdminUser.mockResolvedValue(null as never);
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(401);
  });

  it("400 si aucun fichier n'est fourni", async () => {
    const res = await POST(makeUploadRequest(null) as never);
    expect(res.status).toBe(400);
  });

  it("400 si le fichier dépasse 5 Mo", async () => {
    const res = await POST(
      makeUploadRequest(makeFile({ size: 6 * 1024 * 1024 })) as never,
    );
    expect(res.status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("400 si le type MIME n'est pas autorisé", async () => {
    const res = await POST(
      makeUploadRequest(makeFile({ type: "text/plain", name: "note.txt" })) as never,
    );
    expect(res.status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("201 écrit le PDF sous /cv et renvoie une URL courte", async () => {
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toBe("cv/abcdefghijkl.pdf");
    expect(body.url).toBe("/uploads/cv/abcdefghijkl.pdf");
    expect(body.expiresIn).toBe(60);
    expect(body.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(body.purpose).toBe("cv");
    expect(body.filename).toBe("cv.pdf");
    expect(store.put).toHaveBeenCalledWith("cv/abcdefghijkl.pdf", expect.anything(), "application/pdf");
    // L'URL de lecture est bornée : jamais d'URL signée persistée.
    expect(store.getSignedUrl).toHaveBeenCalledWith("cv/abcdefghijkl.pdf", 60);
  });

  it("range les images sous le préfixe cv/", async () => {
    const res = await POST(
      makeUploadRequest(makeFile({ type: "image/png", name: "photo.png" })) as never,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toBe("cv/abcdefghijkl.png");
  });

  it("persiste la clé stable et l'empreinte, jamais l'URL signée", async () => {
    await POST(makeUploadRequest(makeFile()) as never);
    const payload = db.upsert.mock.calls[0][0];
    expect(payload.create).toMatchObject({
      key: "cv/abcdefghijkl.pdf",
      ownerUserId: "user-1",
      purpose: "cv",
    });
    expect(payload.create.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(payload)).not.toContain("/uploads/");
  });

  it("refuse l'usage officiel (attestation)", async () => {
    const res = await POST(
      makeUploadRequest(makeFile(), { purpose: "attestation" }) as never,
    );
    expect(res.status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("accepte un usage(cv|internship|export|temporary) et le préfixe correspondant", async () => {
    const res = await POST(
      makeUploadRequest(makeFile(), { purpose: "internship" }) as never,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toBe("stages/abcdefghijkl.pdf");
  });

  it("refuse un usage inconnu", async () => {
    const res = await POST(makeUploadRequest(makeFile(), { purpose: "images" }) as never);
    expect(res.status).toBe(400);
  });

  it("200 idempotent : une clé déjà enregistrée renvoie l'objet existant", async () => {
    const res = await POST(
      makeUploadRequest(makeFile(), { key: "cv/abcdefghijkl.pdf" }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(body.objectId).toBe("obj-1");
    expect(store.put).not.toHaveBeenCalled();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("403 si la clé rejouée appartient à un autre utilisateur", async () => {
    db.findUnique.mockResolvedValue(storedObject({ ownerUserId: "user-2" }) as never);
    const res = await POST(
      makeUploadRequest(makeFile(), { key: "cv/abcdefghijkl.pdf" }) as never,
    );
    expect(res.status).toBe(403);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("500 si l'écriture disque échoue", async () => {
    store.put.mockRejectedValue(new Error("disk full") as never);
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/upload", () => {
  it("401 si ni utilisateur ni admin", async () => {
    authDeps.getCurrentUser.mockResolvedValue(null as never);
    authDeps.getAdminUser.mockResolvedValue(null as never);
    const res = await DELETE(makeDeleteRequest("cv/abcdefghijkl.pdf") as never);
    expect(res.status).toBe(401);
  });

  it("400 si la clé est absente", async () => {
    const res = await DELETE(makeDeleteRequest("") as never);
    expect(res.status).toBe(400);
  });

  it("supprime l'objet appartenant à l'utilisateur", async () => {
    const res = await DELETE(makeDeleteRequest("cv/abcdefghijkl.pdf") as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ deleted: true, key: "cv/abcdefghijkl.pdf" });
    expect(store.delete).toHaveBeenCalledWith("cv/abcdefghijkl.pdf");
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { key: "cv/abcdefghijkl.pdf" } });
  });

  it("403 si l'objet appartient à un autre utilisateur", async () => {
    db.findUnique.mockResolvedValue(storedObject({ ownerUserId: "user-2" }) as never);
    const res = await DELETE(makeDeleteRequest("cv/abcdefghijkl.pdf") as never);
    expect(res.status).toBe(403);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("404 si l'objet n'est pas enregistré (clé non devinable)", async () => {
    db.findUnique.mockResolvedValue(null as never);
    const res = await DELETE(makeDeleteRequest("cv/abcdefghijkl.pdf") as never);
    expect(res.status).toBe(404);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("409 si l'objet est un PDF officiel (suppression interdite)", async () => {
    db.findUnique.mockResolvedValue(
      storedObject({ purpose: "attestation", key: "attestations/FSA-2026/v1.pdf" }) as never,
    );
    const res = await DELETE(makeDeleteRequest("attestations/FSA-2026/v1.pdf") as never);
    expect(res.status).toBe(409);
    expect(store.delete).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
  });

  it("409 si l'objet est sous le préfixe officiel attestations/", async () => {
    db.findUnique.mockResolvedValue(
      storedObject({ purpose: "cv", key: "attestations/FSA-2026/v1.pdf" }) as never,
    );
    const res = await DELETE(makeDeleteRequest("attestations/FSA-2026/v1.pdf") as never);
    expect(res.status).toBe(409);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("400 sur une tentative de traversée de répertoire", async () => {
    const res = await DELETE(makeDeleteRequest("../../etc/passwd") as never);
    expect(res.status).toBe(400);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("400 sur une clé hors préfixes autorisés", async () => {
    const res = await DELETE(makeDeleteRequest("images/abcdefghijkl.pdf") as never);
    expect(res.status).toBe(400);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("un admin peut supprimer un objet sans propriétaire", async () => {
    authDeps.getCurrentUser.mockResolvedValue(null as never);
    authDeps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.findUnique.mockResolvedValue(storedObject({ ownerUserId: null, purpose: "temporary" }) as never);
    const res = await DELETE(makeDeleteRequest("temporary/abcdefghijkl.pdf") as never);
    expect(res.status).toBe(200);
  });
});
