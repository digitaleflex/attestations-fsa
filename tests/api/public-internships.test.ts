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
  put: vi.fn(async () => {}),
  getSignedUrl: vi.fn(async (key: string) => `/uploads/${key}`),
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
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, getStorage: () => deps };
});
vi.mock("nanoid", () => ({ nanoid: () => "abcdefghijkl" }));

import { POST } from "../../app/api/public/internships/route";

const validBody = {
  fullName: "Alice Dupont",
  email: "alice@example.com",
  phone: "+22912345678",
  position: "Stagiaire dev",
  university: "UNSTIM",
  level: "L3",
  message: "Motivation",
};

function makePdf() {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], "cv.pdf", {
    type: "application/pdf",
  });
}

function callPost(body: Record<string, string> = validBody, file?: File) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(body)) formData.append(name, value);
  if (file) formData.append("file", file);

  return POST(
    new NextRequest("http://localhost/api/public/internships", {
      method: "POST",
      body: formData,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  deps.notifyAllAdmins.mockResolvedValue(undefined as never);
  deps.sendConfirmation.mockResolvedValue(undefined as never);
  deps.put.mockResolvedValue(undefined as never);
  deps.getSignedUrl.mockImplementation(async (key: string) => `/uploads/${key}`);
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
    const res = await callPost(validBody, makePdf());
    expect(res.status).toBe(429);
    expect(db.internshipCreate).not.toHaveBeenCalled();
  });

  it("415 si le CV n'est pas envoyé en multipart", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/public/internships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );
    expect(res.status).toBe(415);
    expect(db.internshipCreate).not.toHaveBeenCalled();
  });

  it("400 si le CV est absent", async () => {
    const res = await callPost();
    expect(res.status).toBe(400);
    expect(db.internshipCreate).not.toHaveBeenCalled();
  });

  it("400 si le CV dépasse 3 Mo", async () => {
    const file = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "cv.pdf", {
      type: "application/pdf",
    });
    const res = await callPost(validBody, file);
    expect(res.status).toBe(400);
    expect(deps.put).not.toHaveBeenCalled();
  });

  it("400 si le contenu du CV ne correspond pas au PDF annoncé", async () => {
    const file = new File(["not a pdf"], "cv.pdf", { type: "application/pdf" });
    const res = await callPost(validBody, file);
    expect(res.status).toBe(400);
    expect(deps.put).not.toHaveBeenCalled();
  });

  it("400 si l'image n'est pas un PDF", async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "photo.png", {
      type: "image/png",
    });
    const res = await callPost(validBody, file);
    expect(res.status).toBe(400);
    expect(deps.put).not.toHaveBeenCalled();
  });

  it("400 si données invalides (email)", async () => {
    const res = await callPost({ ...validBody, email: "pas-un-email" }, makePdf());
    expect(res.status).toBe(400);
    expect(db.internshipCreate).not.toHaveBeenCalled();
  });

  it("400 si nom trop court", async () => {
    const res = await callPost({ ...validBody, fullName: "A" }, makePdf());
    expect(res.status).toBe(400);
  });

  it("201 — valide et stocke le CV, puis crée la demande en PENDING", async () => {
    const res = await callPost(validBody, makePdf());
    expect(res.status).toBe(201);
    expect(deps.put).toHaveBeenCalledWith(
      "cv/abcdefghijkl.pdf",
      expect.any(Buffer),
      "application/pdf"
    );
    expect(db.internshipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fullName: "Alice Dupont",
          email: "alice@example.com",
          cvUrl: "/uploads/cv/abcdefghijkl.pdf",
          status: "PENDING",
        }),
      }),
    );
  });
});
