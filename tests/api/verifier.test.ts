import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const db = vi.hoisted(() => ({
  attestationFindFirst: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { attestation: { findFirst: db.attestationFindFirst } },
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: db.applyRateLimit,
}));

vi.mock("@/lib/sanitization", () => ({
  sanitizeInput: (value: string) => value,
}));

import { GET } from "../../app/api/verifier/route";

function req(code?: string) {
  const url = code
    ? `http://localhost/api/verifier?code=${encodeURIComponent(code)}`
    : "http://localhost/api/verifier";
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.applyRateLimit.mockResolvedValue({ allowed: true } as never);
});

describe("GET /api/verifier", () => {
  it("400 si le code est absent ou trop court", async () => {
    const missing = await GET(req());
    expect(missing.status).toBe(400);

    const tooShort = await GET(req("abc"));
    expect(tooShort.status).toBe(400);
  });

  it("404 si aucun certificat ne correspond", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(404);
  });

  it("200 et mappe certificationScore -> score quand trouvé", async () => {
    db.attestationFindFirst.mockResolvedValue({
      id: "a1",
      code: "FSA-2026-M01-00001-abcde",
      fullName: "Alice",
      type: "CERTIFICATION",
      status: "VALIDATED",
      certificationScore: 88,
      stageScore: 90,
      issuedAt: new Date("2026-01-02"),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-01-02"),
      location: "En ligne",
      instructor: "FSA",
      formation: { name: "Pisciculture", category: "AGRICULTURE" },
    } as never);

    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.attestation.score).toBe(88);
    expect(body.attestation.code).toBe("FSA-2026-M01-00001-abcde");
  });

  it("respecte le rate limiting (renvoie la réponse 429)", async () => {
    db.applyRateLimit.mockResolvedValue({
      allowed: false,
      response: NextResponse.json(
        { error: "Trop de requêtes" },
        { status: 429 },
      ),
    } as never);

    const res = await GET(req("FSA-2026-M01-00001-abcde"));
    expect(res.status).toBe(429);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });
});
