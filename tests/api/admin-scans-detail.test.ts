import { vi, describe, it, expect, beforeEach } from "vitest";
import { Readable } from "stream";

const db = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  scanFindUnique: vi.fn(),
  scanFindFirst: vi.fn(),
  scanCreate: vi.fn(),
  scanDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findUnique: db.sessionFindUnique },
    compositionScan: {
      findUnique: db.scanFindUnique,
      findFirst: db.scanFindFirst,
      create: db.scanCreate,
      delete: db.scanDelete,
    },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));

// Le route d'upload écrit sur disque et la route de lecture streame un fichier.
// On mocke fs / fs/promises pour rester hermétique (aucune écriture réelle).
const fsMocks = vi.hoisted(() => ({
  createReadStream: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  existsSync: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    createReadStream: fsMocks.createReadStream,
    existsSync: fsMocks.existsSync,
  };
});

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return {
    ...actual,
    writeFile: fsMocks.writeFile,
    mkdir: fsMocks.mkdir,
    unlink: fsMocks.unlink,
    stat: fsMocks.stat,
  };
});

import {
  GET as getScans,
  POST as uploadScans,
  DELETE as deleteScan,
} from "../../app/api/admin/submissions/[id]/scans/route";
import { GET as getScanFile } from "../../app/api/admin/submissions/[id]/scans/[scanId]/route";

const SUB = "sub-1";
const SCAN = "scan-1";

function makeScan(overrides: Record<string, unknown> = {}) {
  return {
    id: SCAN,
    submissionId: SUB,
    url: `/api/admin/submissions/${SUB}/scans/${SCAN}`,
    pageNumber: 1,
    fileName: "doc.pdf",
    fileSize: 8,
    uploadedBy: "admin-1",
    ...overrides,
  };
}

function pdfFile() {
  // Magic bytes %PDF-1.4 — nécessaire pour passer detectFileType.
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  return new File([bytes], "doc.pdf", { type: "application/pdf" });
}

function callGetScans() {
  return getScans(
    new Request(`http://localhost/api/admin/submissions/${SUB}/scans`),
    { params: Promise.resolve({ id: SUB }) },
  );
}

function callUpload(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("scans", file);
  return uploadScans(
    new Request(`http://localhost/api/admin/submissions/${SUB}/scans`, {
      method: "POST",
      body: form,
    }),
    { params: Promise.resolve({ id: SUB }) },
  );
}

function callDelete(scanId?: string) {
  const suffix = scanId ? `?scanId=${scanId}` : "";
  return deleteScan(
    new Request(`http://localhost/api/admin/submissions/${SUB}/scans${suffix}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: SUB }) },
  );
}

function callGetScanFile() {
  return getScanFile(
    new Request(`http://localhost/api/admin/submissions/${SUB}/scans/${SCAN}`),
    { params: Promise.resolve({ id: SUB, scanId: SCAN }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  db.sessionFindUnique.mockResolvedValue({
    id: SUB,
    scans: [makeScan()],
  } as never);
  db.scanFindUnique.mockResolvedValue(makeScan() as never);
  db.scanFindFirst.mockResolvedValue(makeScan() as never);
  db.scanCreate.mockResolvedValue(makeScan() as never);
  db.scanDelete.mockResolvedValue(makeScan() as never);
  fsMocks.existsSync.mockReturnValue(true);
  fsMocks.mkdir.mockResolvedValue(undefined);
  fsMocks.writeFile.mockResolvedValue(undefined);
  fsMocks.unlink.mockResolvedValue(undefined);
  fsMocks.stat.mockResolvedValue({ isFile: () => true, size: 8 } as never);
  fsMocks.createReadStream.mockReturnValue(
    Readable.from(Buffer.from("%PDF-1.4")) as never,
  );
});

describe("GET /api/admin/submissions/[id]/scans", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGetScans();
    expect(res.status).toBe(401);
  });

  it("404 si soumission introuvable", async () => {
    db.sessionFindUnique.mockResolvedValue(null as never);
    const res = await callGetScans();
    expect(res.status).toBe(404);
  });

  it("200 → retourne les scans de la soumission", async () => {
    const res = await callGetScans();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scans).toHaveLength(1);
  });
});

describe("POST /api/admin/submissions/[id]/scans", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callUpload([pdfFile()]);
    expect(res.status).toBe(401);
  });

  it("404 si soumission introuvable", async () => {
    db.sessionFindUnique.mockResolvedValue(null as never);
    const res = await callUpload([pdfFile()]);
    expect(res.status).toBe(404);
  });

  it("400 si aucun fichier fourni", async () => {
    const res = await callUpload([]);
    expect(res.status).toBe(400);
    expect(db.scanCreate).not.toHaveBeenCalled();
  });

  it("400 si le type MIME est refusé", async () => {
    const txt = new File([new Uint8Array([1, 2, 3, 4])], "notes.txt", {
      type: "text/plain",
    });
    const res = await callUpload([txt]);
    expect(res.status).toBe(400);
    expect(db.scanCreate).not.toHaveBeenCalled();
  });

  it("400 si les magic bytes ne correspondent pas au type déclaré", async () => {
    // Déclaré PDF mais contenu non-PDF → detectFileType renvoie null.
    const fake = new File([new Uint8Array([1, 2, 3, 4])], "fake.pdf", {
      type: "application/pdf",
    });
    const res = await callUpload([fake]);
    expect(res.status).toBe(400);
  });

  it("200 → écrit le fichier et crée le scan", async () => {
    const res = await callUpload([pdfFile()]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(fsMocks.writeFile).toHaveBeenCalled();
    expect(db.scanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submissionId: SUB, uploadedBy: "admin-1" }),
      }),
    );
  });
});

describe("DELETE /api/admin/submissions/[id]/scans", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callDelete(SCAN);
    expect(res.status).toBe(401);
  });

  it("400 si scanId manquant", async () => {
    const res = await callDelete();
    expect(res.status).toBe(400);
  });

  it("404 si le scan n'appartient pas à la soumission", async () => {
    db.scanFindUnique.mockResolvedValue(null as never);
    const res = await callDelete("scan-x");
    expect(res.status).toBe(404);
  });

  it("200 → supprime le fichier physique et l'entrée BDD", async () => {
    const res = await callDelete(SCAN);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedScanId).toBe(SCAN);
    expect(fsMocks.unlink).toHaveBeenCalled();
    expect(db.scanDelete).toHaveBeenCalledWith({ where: { id: SCAN } });
  });
});

describe("GET /api/admin/submissions/[id]/scans/[scanId]", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callGetScanFile();
    expect(res.status).toBe(401);
  });

  it("404 si le scan n'appartient pas à la soumission", async () => {
    db.scanFindFirst.mockResolvedValue(null as never);
    const res = await callGetScanFile();
    expect(res.status).toBe(404);
  });

  it("404 si le chemin résolu tente une traversée", async () => {
    db.scanFindFirst.mockResolvedValue(
      makeScan({ url: "/secure-files/scans/.." }) as never,
    );
    const res = await callGetScanFile();
    expect(res.status).toBe(404);
  });

  it("404 si le fichier est absent du disque", async () => {
    fsMocks.stat.mockRejectedValue(new Error("ENOENT") as never);
    const res = await callGetScanFile();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Fichier scan introuvable sur le disque");
  });

  it("404 si le chemin n'est pas un fichier régulier", async () => {
    fsMocks.stat.mockResolvedValue({ isFile: () => false, size: 0 } as never);
    const res = await callGetScanFile();
    expect(res.status).toBe(404);
  });

  it("200 → streame le fichier avec les en-têtes de sécurité", async () => {
    const res = await callGetScanFile();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(fsMocks.createReadStream).toHaveBeenCalled();
  });
});
