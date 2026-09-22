import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  scanFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    compositionScan: { findFirst: db.scanFindFirst },
  },
}));

const deps = vi.hoisted(() => ({ getAdminUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

const store = vi.hoisted(() => ({
  exists: vi.fn<(key: string) => Promise<boolean>>(async () => true),
  getSignedUrl: vi.fn<(key: string) => Promise<string>>(
    async (key: string) => `/uploads/${key}`,
  ),
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => store }));

import { GET } from "../../app/api/admin/submissions/[id]/scans/[scanId]/route";

const PDF = Buffer.from("%PDF-1.4 contenu");

function callGet(scanId = "s1") {
  const request = new Request(
    `http://localhost/api/admin/submissions/sub-1/scans/${scanId}`,
  );
  return GET(request, {
    params: Promise.resolve({ id: "sub-1", scanId }),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.scanFindFirst.mockResolvedValue({
    id: "s1",
    submissionId: "sub-1",
    url: "/api/admin/submissions/sub-1/scans/s1",
    fileName: "copie.pdf",
  } as never);
  store.exists.mockResolvedValue(true as never);
  store.getSignedUrl.mockImplementation(
    async (key: string) => `/uploads/${key}`,
  );
  fetchMock.mockResolvedValue(
    new Response(new Uint8Array(PDF), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(PDF.length),
      },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/admin/submissions/[id]/scans/[scanId] (proxy storage, #149)", () => {
  it("401 sans session admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(401);
    expect(store.exists).not.toHaveBeenCalled();
  });

  it("404 si le scan appartient à une autre soumission", async () => {
    db.scanFindFirst.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(404);
    expect(db.scanFindFirst).toHaveBeenCalledWith({
      where: { id: "s1", submissionId: "sub-1" },
    });
    expect(store.exists).not.toHaveBeenCalled();
  });

  it("404 propre si l'objet est absent du stockage (ligne BDD présente)", async () => {
    store.exists.mockResolvedValue(false as never);
    const res = await callGet();
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("200 — sert le flux avec le Content-Type et les en-têtes de sécurité", async () => {
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-length")).toBe(String(PDF.length));
    expect(res.headers.get("content-disposition")).toBe(
      'inline; filename="copie.pdf"',
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toContain("%PDF-1.4");
  });

  it("proxifie l'objet depuis la clé de stockage sans exposer l'URL signée", async () => {
    await callGet();
    expect(store.exists).toHaveBeenCalledWith("scans/sub-1/s1.pdf");
    expect(store.getSignedUrl).toHaveBeenCalledWith("scans/sub-1/s1.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const target = fetchMock.mock.calls[0][0] as URL;
    expect(target.toString()).toBe("http://localhost/uploads/scans/sub-1/s1.pdf");
  });

  it("compatibilité descendante — ancienne URL /secure-files/scans/<fichier>", async () => {
    db.scanFindFirst.mockResolvedValue({
      id: "s1",
      submissionId: "sub-1",
      url: "/secure-files/scans/ancien-scan.jpg",
      fileName: "ancien.jpg",
    } as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(store.exists).toHaveBeenCalledWith(
      "scans/sub-1/ancien-scan.jpg",
    );
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("500 si le stockage est en erreur (pas de faux 404)", async () => {
    store.exists.mockRejectedValueOnce(new Error("S3 down"));
    const res = await callGet();
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404 si le flux distant est introuvable (objet supprimé entre-temps)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await callGet();
    expect(res.status).toBe(404);
  });
});
