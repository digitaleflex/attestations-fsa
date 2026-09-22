import { vi, describe, it, expect, beforeEach } from "vitest";

const authDeps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: authDeps.getCurrentUser,
  getAdminUser: authDeps.getAdminUser,
}));

const fsDeps = vi.hoisted(() => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  writeFile: fsDeps.writeFile,
  mkdir: fsDeps.mkdir,
}));

vi.mock("nanoid", () => ({ nanoid: () => "abcdefghijkl" }));

import { POST } from "../../app/api/upload/route";

interface FakeFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function makeFile(overrides: Partial<FakeFile> = {}): FakeFile {
  return {
    name: "cv.pdf",
    type: "application/pdf",
    size: 1234,
    arrayBuffer: async () => new ArrayBuffer(4),
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
  fsDeps.writeFile.mockResolvedValue(undefined as never);
  fsDeps.mkdir.mockResolvedValue(undefined as never);
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
    expect(fsDeps.writeFile).not.toHaveBeenCalled();
  });

  it("400 si le type MIME n'est pas autorisé", async () => {
    const res = await POST(
      makeUploadRequest(makeFile({ type: "text/plain", name: "note.txt" })) as never,
    );
    expect(res.status).toBe(400);
    expect(fsDeps.writeFile).not.toHaveBeenCalled();
  });

  it("201 écrit le PDF dans /uploads/cv et renvoie l'URL publique", async () => {
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBe("/uploads/cv/abcdefghijkl.pdf");
    expect(body.filename).toBe("cv.pdf");
    expect(fsDeps.mkdir).toHaveBeenCalled();
    expect(fsDeps.writeFile).toHaveBeenCalled();
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
    fsDeps.writeFile.mockRejectedValue(new Error("disk full") as never);
    const res = await POST(makeUploadRequest(makeFile()) as never);
    expect(res.status).toBe(500);
  });
});
