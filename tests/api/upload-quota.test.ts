import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * #287 — Quota d'upload (nombre de fichiers + débit) sur POST /api/upload.
 *
 * Le compteur est distribué (Redis) et l'identité vient du proxy de confiance
 * (cf. tests/lib/rate-limit-identity.test.ts), jamais d'un `x-forwarded-for`
 * accepté tel quel.
 */

const authDeps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: authDeps.getCurrentUser,
  getAdminUser: authDeps.getAdminUser,
}));

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
  prisma: {
    storedObject: {
      findUnique: db.findUnique,
      upsert: db.upsert,
      deleteMany: db.deleteMany,
    },
  },
}));

vi.mock("nanoid", () => ({ nanoid: () => "abcdefghijkl" }));

import { POST } from "../../app/api/upload/route";
import {
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

const CHECKSUM = "a".repeat(64);

function makeFile(size = 8) {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  return {
    name: "cv.pdf",
    type: "application/pdf",
    size,
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  };
}

function makeUploadRequest(ip = "203.0.113.7") {
  return {
    formData: async () => ({
      get: (key: string) => (key === "file" ? makeFile() : null),
    }),
    headers: new Headers({ "x-forwarded-for": ip }),
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

const originalLimits = { ...memoryFallbackLimits };

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.clearAllMocks();
  authDeps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  authDeps.getAdminUser.mockResolvedValue(null as never);
  store.put.mockResolvedValue(undefined as never);
  store.getSignedUrl.mockImplementation(async (key: string) => `/uploads/${key}`);
  db.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) =>
    storedObject(create as Record<string, unknown>),
  );
  db.findUnique.mockResolvedValue(storedObject() as never);
  db.deleteMany.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  Object.assign(memoryFallbackLimits, originalLimits);
  vi.unstubAllEnvs();
});

describe("#287 — quota d'upload", () => {
  it("un envoi normal passe (le quota n'est pas bloquant en dessous du budget)", async () => {
    const res = await POST(makeUploadRequest() as never);
    expect(res.status).toBe(201);
  });

  it("refuse (429) au-delà du quota de fichiers et n'écrit plus rien", async () => {
    memoryFallbackLimits.upload = { max: 2, windowMs: 60 * 60_000 };
    for (let i = 0; i < 2; i++) {
      const ok = await POST(makeUploadRequest() as never);
      expect(ok.status).toBe(201);
    }
    const blocked = await POST(makeUploadRequest() as never);
    expect(blocked.status).toBe(429);
    expect(store.put).toHaveBeenCalledTimes(2);
  });

  it("refuse (429) au-delà du quota de DÉBIT, même sous le quota de fichiers", async () => {
    memoryFallbackLimits.upload = { max: 100, windowMs: 60 * 60_000 };
    memoryFallbackLimits.uploadBytes = { max: 8, windowMs: 60 * 60_000 };
    const first = await POST(makeUploadRequest() as never);
    expect(first.status).toBe(201);
    const second = await POST(makeUploadRequest() as never);
    expect(second.status).toBe(429);
    expect(store.put).toHaveBeenCalledTimes(1);
  });

  it("le quota de débit est propre à chaque utilisateur", async () => {
    memoryFallbackLimits.upload = { max: 100, windowMs: 60 * 60_000 };
    memoryFallbackLimits.uploadBytes = { max: 8, windowMs: 60 * 60_000 };
    expect((await POST(makeUploadRequest() as never)).status).toBe(201);
    // Autre utilisateur, autre IP : son budget de débit est intact.
    authDeps.getCurrentUser.mockResolvedValue({ id: "user-2" } as never);
    const other = await POST(makeUploadRequest("198.51.100.9") as never);
    expect(other.status).toBe(201);
  });

  it("le quota est compté AVANT l'authentification (IP), pas après", async () => {
    // Un attaquant sans session ne peut pas épuiser un budget infini de 401.
    memoryFallbackLimits.upload = { max: 1, windowMs: 60 * 60_000 };
    authDeps.getCurrentUser.mockResolvedValue(null as never);
    authDeps.getAdminUser.mockResolvedValue(null as never);
    expect((await POST(makeUploadRequest() as never)).status).toBe(401);
    const second = await POST(makeUploadRequest() as never);
    expect(second.status).toBe(429);
  });

  it("fail-closed : sans Redis, l'upload est refusé (503) en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
    const res = await POST(makeUploadRequest() as never);
    expect(res.status).toBe(503);
    expect(store.put).not.toHaveBeenCalled();
  });
});
