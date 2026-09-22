import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examSessionFindUnique: vi.fn(),
  scanCreate: vi.fn(),
  scanFindUnique: vi.fn(),
  scanDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.examSessionFindUnique },
    compositionScan: {
      create: db.scanCreate,
      findUnique: db.scanFindUnique,
      delete: db.scanDelete,
    },
  },
}));

const deps = vi.hoisted(() => ({ getAdminUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

// Driver de stockage objet mocké : on vérifie les appels put/delete et les clés.
const store = vi.hoisted(() => ({
  put: vi.fn<(key: string, body: Buffer, contentType: string) => Promise<void>>(
    async () => {},
  ),
  delete: vi.fn<(key: string) => Promise<void>>(async () => {}),
  exists: vi.fn<(key: string) => Promise<boolean>>(async () => true),
  getSignedUrl: vi.fn<(key: string) => Promise<string>>(
    async () => "/uploads/scans/sub-1/s1.pdf",
  ),
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => store }));

import { POST, DELETE } from "../../app/api/admin/submissions/[id]/scans/route";

const PDF = Buffer.concat([Buffer.from("%PDF-1.4"), Buffer.alloc(32)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

interface UploadFile {
  name: string;
  type: string;
  bytes: Buffer;
}

function makePostRequest(files: UploadFile[]): Request {
  const formData = new FormData();
  for (const file of files) {
    formData.append(
      "scans",
      new File([new Uint8Array(file.bytes)], file.name, { type: file.type }),
    );
  }
  return new Request("http://localhost/api/admin/submissions/sub-1/scans", {
    method: "POST",
    body: formData,
  });
}

function callPost(files: UploadFile[]) {
  return POST(makePostRequest(files), {
    params: Promise.resolve({ id: "sub-1" }),
  });
}

function callDelete(scanId: string | null) {
  const query = scanId ? `?scanId=${scanId}` : "";
  const request = new Request(
    `http://localhost/api/admin/submissions/sub-1/scans${query}`,
    { method: "DELETE" },
  );
  return DELETE(request, { params: Promise.resolve({ id: "sub-1" }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.examSessionFindUnique.mockResolvedValue({ id: "sub-1" } as never);
  db.scanCreate.mockImplementation(async ({ data }: { data: unknown }) => data);
  db.scanFindUnique.mockResolvedValue({
    id: "s1",
    submissionId: "sub-1",
    url: "/api/admin/submissions/sub-1/scans/s1",
    fileName: "p1.pdf",
  } as never);
  db.scanDelete.mockResolvedValue({} as never);
});

describe("POST /api/admin/submissions/[id]/scans (stockage objet, #149)", () => {
  it("401 sans session admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost([{ name: "p1.pdf", type: "application/pdf", bytes: PDF }]);
    expect(res.status).toBe(401);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("rejette un fichier déguisé (contenu ≠ type déclaré)", async () => {
    const res = await callPost([
      { name: "faux.png", type: "image/png", bytes: PDF },
    ]);
    expect(res.status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();
    expect(db.scanCreate).not.toHaveBeenCalled();
  });

  it("rejette un fichier > 5 Mo et accepte la borne exacte", async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const rejected = await callPost([
      { name: "gros.png", type: "image/png", bytes: tooBig },
    ]);
    expect(rejected.status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();

    vi.clearAllMocks();
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    db.examSessionFindUnique.mockResolvedValue({ id: "sub-1" } as never);
    db.scanCreate.mockImplementation(async ({ data }: { data: unknown }) => data);
    const exact = Buffer.alloc(5 * 1024 * 1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(exact);
    const accepted = await callPost([
      { name: "limite.png", type: "image/png", bytes: exact },
    ]);
    expect(accepted.status).toBe(200);
    expect(store.put).toHaveBeenCalledTimes(1);
  });

  it("rejette plus de 10 fichiers", async () => {
    const files = Array.from({ length: 11 }, (_, i) => ({
      name: `p${i}.png`,
      type: "image/png",
      bytes: PNG,
    }));
    const res = await callPost(files);
    expect(res.status).toBe(400);
    expect(store.put).not.toHaveBeenCalled();
  });

  it("rejette un upload sans fichier", async () => {
    const res = await callPost([]);
    expect(res.status).toBe(400);
  });

  it("upload OK — N objets + N lignes, pageNumber séquentiel, url inchangée", async () => {
    const res = await callPost([
      { name: "p1.pdf", type: "application/pdf", bytes: PDF },
      { name: "p2.png", type: "image/png", bytes: PNG },
    ]);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ count: 2 });

    expect(store.put).toHaveBeenCalledTimes(2);
    expect(db.scanCreate).toHaveBeenCalledTimes(2);

    const firstData = db.scanCreate.mock.calls[0][0].data;
    const secondData = db.scanCreate.mock.calls[1][0].data;

    // Clé d'objet déterministe alignée sur l'id BDD.
    expect(store.put.mock.calls[0][0]).toBe(`scans/sub-1/${firstData.id}.pdf`);
    expect(store.put.mock.calls[0][2]).toBe("application/pdf");
    expect(store.put.mock.calls[1][0]).toBe(`scans/sub-1/${secondData.id}.png`);
    expect(store.put.mock.calls[1][2]).toBe("image/png");

    // pageNumber séquentiel + format d'URL préservé (écran admin).
    expect(firstData.pageNumber).toBe(1);
    expect(secondData.pageNumber).toBe(2);
    expect(firstData.url).toBe(`/api/admin/submissions/sub-1/scans/${firstData.id}`);
    expect(secondData.url).toBe(`/api/admin/submissions/sub-1/scans/${secondData.id}`);

    // Aucune écriture filesystem résiduelle n'est possible : le seul canal
    // est le driver de stockage.
    expect(store.put).toHaveBeenCalledWith(
      expect.stringMatching(/^scans\/sub-1\/[0-9a-f-]+\.pdf$/),
      expect.any(Buffer),
      "application/pdf",
    );
  });
});

describe("DELETE /api/admin/submissions/[id]/scans (stockage objet, #149)", () => {
  it("401 sans session admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callDelete("s1");
    expect(res.status).toBe(401);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("400 sans paramètre scanId", async () => {
    const res = await callDelete(null);
    expect(res.status).toBe(400);
  });

  it("404 si le scan n'appartient pas à la soumission", async () => {
    db.scanFindUnique.mockResolvedValue(null as never);
    const res = await callDelete("autre-scan");
    expect(res.status).toBe(404);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("supprime l'objet puis la ligne BDD", async () => {
    const res = await callDelete("s1");
    expect(res.status).toBe(200);
    expect(store.delete).toHaveBeenCalledWith("scans/sub-1/s1.pdf");
    expect(db.scanDelete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("objet déjà absent — pas d'erreur, la ligne est supprimée", async () => {
    store.delete.mockResolvedValue(undefined as never);
    const res = await callDelete("s1");
    expect(res.status).toBe(200);
    expect(db.scanDelete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("erreur de stockage — la ligne BDD est tout de même supprimée", async () => {
    store.delete.mockRejectedValueOnce(new Error("S3 indisponible"));
    const res = await callDelete("s1");
    expect(res.status).toBe(200);
    expect(db.scanDelete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
