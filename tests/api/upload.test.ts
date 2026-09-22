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
// validateUpload) reste réel.
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

vi.mock("nanoid", () => ({ nanoid: () => "abcdefghijkl" }));

import { POST } from "../../app/api/upload/route";

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
  headers: Record<string, string> = {},
) {
  return {
    formData: async () => ({
      get: (key: string) => (key === "file" ? file : null),
    }),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  authDeps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  authDeps.getAdminUser.mockResolvedValue(null as never);
  store.put.mockResolvedValue(undefined as never);
  store.getSignedUrl.mockImplementation(async (key: string) => `/uploads/${key}`);
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

  it("201 écrit le PDF dans /uploads/cv et renvoie l'URL publique", async () => {
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBe("/uploads/cv/abcdefghijkl.pdf");
    expect(body.filename).toBe("cv.pdf");
    expect(store.put).toHaveBeenCalled();
  });

  it("201 range les images dans /uploads/images", async () => {
    const res = await POST(
      makeUploadRequest(
        makeFile({ type: "image/png", name: "photo.png" }),
      ) as never,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBe("/uploads/images/abcdefghijkl.png");
  });

  it("500 si l'écriture disque échoue", async () => {
    store.put.mockRejectedValue(new Error("disk full") as never);
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(500);
  });
});
