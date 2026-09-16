import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  internshipCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    internshipRequest: { create: db.internshipCreate },
  },
}));

const deps = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  notifyAllAdmins: vi.fn(),
  sendConfirmation: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: deps.applyRateLimit,
}));
vi.mock("@/lib/notifications", () => ({
  notifyAllAdmins: deps.notifyAllAdmins,
}));
vi.mock("@/lib/email", () => ({
  emailService: { sendInternshipConfirmation: deps.sendConfirmation },
}));

import { POST } from "../../app/api/public/internships/route";

function callPost(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/public/internships", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validBody = {
  fullName: "Alice Dupont",
  email: "alice@example.com",
  phone: "+22912345678",
  position: "Stagiaire dev",
  university: "UNSTIM",
  level: "L3",
  message: "Motivation",
};

beforeEach(() => {
  vi.clearAllMocks();
  deps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  deps.notifyAllAdmins.mockResolvedValue(undefined as never);
  deps.sendConfirmation.mockResolvedValue(undefined as never);
  db.internshipCreate.mockResolvedValue({ id: "intern-1" } as never);
});

describe("POST /api/public/internships (#138)", () => {
  it("429 si rate limité", async () => {
    const response = new Response(JSON.stringify({ error: "Trop de requêtes" }), {
      status: 429,
    });
    deps.applyRateLimit.mockResolvedValue({
      allowed: false,
      response,
    } as never);
    const res = await callPost(validBody);
    expect(res.status).toBe(429);
    expect(db.internshipCreate).not.toHaveBeenCalled();
  });

  it("400 si données invalides (email)", async () => {
    const res = await callPost({ ...validBody, email: "pas-un-email" });
    expect(res.status).toBe(400);
    expect(db.internshipCreate).not.toHaveBeenCalled();
  });

  it("400 si nom trop court", async () => {
    const res = await callPost({ ...validBody, fullName: "A" });
    expect(res.status).toBe(400);
  });

  it("201 — crée la demande de stage en PENDING", async () => {
    const res = await callPost(validBody);
    expect(res.status).toBe(201);
    expect(db.internshipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fullName: "Alice Dupont",
          email: "alice@example.com",
          status: "PENDING",
        }),
      }),
    );
  });
});