import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  formationFindUnique: vi.fn(),
  contactCreate: vi.fn(),
  settingsFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: db.formationFindUnique },
    contact: { create: db.contactCreate },
    settings: { findFirst: db.settingsFindFirst },
  },
}));

const emailDeps = vi.hoisted(() => ({
  sendGeneralNotification: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  emailService: {
    sendGeneralNotification: emailDeps.sendGeneralNotification,
  },
}));

const rateLimitDeps = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: rateLimitDeps.applyRateLimit,
}));

import { POST } from "../../app/api/formations/inscription/route";
import { makeRequest } from "../helpers/request";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    nom: "Alice Dupont",
    email: "alice@example.com",
    telephone: "+237600000000",
    formationId: "formation-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitDeps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  db.formationFindUnique.mockResolvedValue({ name: "Licence FSA" } as never);
  db.contactCreate.mockResolvedValue({ id: "contact-1" } as never);
  db.settingsFindFirst.mockResolvedValue(null as never);
  emailDeps.sendGeneralNotification.mockResolvedValue(undefined as never);
});

describe("POST /api/formations/inscription", () => {
  it("400 si un champ obligatoire manque", async () => {
    const res = await POST(makeRequest({ nom: "Alice", email: "a@b.com" }));
    expect(res.status).toBe(400);
    expect(db.contactCreate).not.toHaveBeenCalled();
  });

  it("404 si la formation est introuvable", async () => {
    db.formationFindUnique.mockResolvedValue(null as never);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(404);
    expect(db.contactCreate).not.toHaveBeenCalled();
  });

  it("200 crée le contact et notifie l'administration", async () => {
    db.settingsFindFirst.mockResolvedValue({
      supportEmail: "admin@fsa.test",
    } as never);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.contactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Alice Dupont",
        email: "alice@example.com",
        phone: "+237600000000",
        subject: "Inscription formation: Licence FSA",
        category: "FORMATION_INSCRIPTION",
      }),
    });
    expect(emailDeps.sendGeneralNotification).toHaveBeenCalledWith(
      "admin@fsa.test",
      "Administration FSA",
      "Nouvelle inscription à une formation",
      expect.any(String),
    );
  });

  it("200 même si la notification e-mail échoue", async () => {
    emailDeps.sendGeneralNotification.mockRejectedValue(
      new Error("smtp down") as never,
    );
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("500 si la création du contact échoue", async () => {
    db.contactCreate.mockRejectedValue(new Error("db down") as never);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(500);
  });

  it("400 si l'email est invalide (zod, avec détails)", async () => {
    const res = await POST(makeRequest(validBody({ email: "pas-un-email" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details).toBeDefined();
    expect(db.contactCreate).not.toHaveBeenCalled();
  });

  it("429 si rate limité (réponse du limiteur relayée)", async () => {
    const limited = new Response(JSON.stringify({ error: "Trop de requêtes" }), {
      status: 429,
    });
    rateLimitDeps.applyRateLimit.mockResolvedValue({
      allowed: false,
      response: limited,
    } as never);
    const res = await POST(makeRequest(validBody()));
    expect(res.status).toBe(429);
    expect(db.contactCreate).not.toHaveBeenCalled();
  });
});
