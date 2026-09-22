import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  attestationFindUnique: vi.fn(),
  attestationFindFirst: vi.fn(),
  attestationUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: db.userFindUnique },
    attestation: {
      findUnique: db.attestationFindUnique,
      findFirst: db.attestationFindFirst,
      update: db.attestationUpdate,
    },
  },
}));

const authApi = vi.hoisted(() => ({
  sendVerificationOTP: vi.fn(),
  signInEmailOTP: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: authApi } }));

const rateLimit = vi.hoisted(() => ({
  fsaOtpRequest: null as null | { limit: ReturnType<typeof vi.fn> },
  fsaOtpVerify: null as null | { limit: ReturnType<typeof vi.fn> },
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimits: rateLimit }));

import { POST } from "../../app/api/auth/fsa-login/route";
import { makeRequest } from "../helpers/request";

function authResponse(ok: boolean, status = 200, cookies: string[] = []) {
  return { ok, status, headers: { getSetCookie: () => cookies } };
}

function call(body: unknown) {
  return POST(makeRequest(body, { "x-forwarded-for": "1.2.3.4" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.fsaOtpRequest = null;
  rateLimit.fsaOtpVerify = null;
  db.userFindUnique.mockResolvedValue({
    id: "user-1",
    email: "alice@example.com",
    name: "Alice",
    role: "user",
  } as never);
  db.attestationFindFirst.mockResolvedValue(null as never);
  db.attestationFindUnique.mockResolvedValue(null as never);
  db.attestationUpdate.mockResolvedValue({ id: "att-1" } as never);
  authApi.sendVerificationOTP.mockResolvedValue(
    authResponse(true, 200, ["session=abc"]) as never,
  );
  authApi.signInEmailOTP.mockResolvedValue(
    authResponse(true, 200, ["session_token=xyz"]) as never,
  );
});

describe("POST /api/auth/fsa-login — validation", () => {
  it("400 si le payload ne correspond à aucune action", async () => {
    const res = await call({ action: "inconnue" });
    expect(res.status).toBe(400);
  });

  it("400 si le code FSA est trop court", async () => {
    const res = await call({ action: "request-otp", fsaCode: "abc" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/fsa-login — request-otp", () => {
  it("404 si l'email n'est associé à aucun compte", async () => {
    db.userFindUnique.mockResolvedValue(null as never);
    const res = await call({ action: "request-otp", fsaCode: "ghost@example.com" });
    expect(res.status).toBe(404);
  });

  it("403 pour un compte administrateur", async () => {
    db.userFindUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
    } as never);
    const res = await call({ action: "request-otp", fsaCode: "admin@example.com" });
    expect(res.status).toBe(403);
  });

  it("404 si le code FSA est introuvable", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    const res = await call({ action: "request-otp", fsaCode: "ABC12" });
    expect(res.status).toBe(404);
  });

  it("400 si le dossier trouvé n'a pas d'email", async () => {
    db.attestationFindFirst.mockResolvedValue({
      id: "att-1",
      email: null,
      fullName: "Alice",
    } as never);
    const res = await call({ action: "request-otp", fsaCode: "ABC12" });
    expect(res.status).toBe(400);
  });

  it("429 si le rate limiter refuse", async () => {
    rateLimit.fsaOtpRequest = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        reset: Date.now() + 60_000,
      }),
    };
    const res = await call({ action: "request-otp", fsaCode: "alice@example.com" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("500 si l'envoi de l'OTP échoue", async () => {
    authApi.sendVerificationOTP.mockResolvedValue(
      authResponse(false, 500) as never,
    );
    const res = await call({ action: "request-otp", fsaCode: "alice@example.com" });
    expect(res.status).toBe(500);
  });

  it("200 envoie l'OTP et masque l'email", async () => {
    const res = await call({ action: "request-otp", fsaCode: "alice@example.com" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.emailMasked).toBe("al***e@example.com");
    expect(body.name).toBe("Alice");
  });
});

describe("POST /api/auth/fsa-login — verify-otp", () => {
  it("403 pour un compte administrateur", async () => {
    db.userFindUnique.mockResolvedValue({
      id: "admin-1",
      role: "admin",
    } as never);
    const res = await call({
      action: "verify-otp",
      fsaCode: "admin@example.com",
      otp: "123456",
    });
    expect(res.status).toBe(403);
  });

  it("429 si le rate limiter refuse", async () => {
    rateLimit.fsaOtpVerify = {
      limit: vi.fn().mockResolvedValue({
        success: false,
        reset: Date.now() + 60_000,
      }),
    };
    const res = await call({
      action: "verify-otp",
      fsaCode: "alice@example.com",
      otp: "123456",
    });
    expect(res.status).toBe(429);
  });

  it("401 si le code OTP est invalide", async () => {
    authApi.signInEmailOTP.mockResolvedValue(authResponse(false, 401) as never);
    const res = await call({
      action: "verify-otp",
      fsaCode: "alice@example.com",
      otp: "000000",
    });
    expect(res.status).toBe(401);
  });

  it("200 crée la session et renvoie le rôle", async () => {
    const res = await call({
      action: "verify-otp",
      fsaCode: "alice@example.com",
      otp: "123456",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.role).toBe("user");
  });

  it("associe l'attestation trouvée à l'utilisateur connecté", async () => {
    db.attestationFindUnique.mockResolvedValue({
      id: "att-1",
      email: "alice@example.com",
      fullName: "Alice",
      userId: "ancien-user",
    } as never);
    const res = await call({
      action: "verify-otp",
      fsaCode: "FSA-2026-M09-00001-abcde",
      otp: "123456",
    });
    expect(res.status).toBe(200);
    expect(db.attestationUpdate).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { userId: "user-1" },
    });
  });
});

describe("POST /api/auth/fsa-login — autres actions", () => {
  it("410 : le magic link est désactivé", async () => {
    const res = await call({
      action: "request-magic-link",
      fsaCode: "alice@example.com",
    });
    expect(res.status).toBe(410);
  });

  it("500 si une erreur fatale survient", async () => {
    authApi.sendVerificationOTP.mockRejectedValue(new Error("boom") as never);
    const res = await call({ action: "request-otp", fsaCode: "alice@example.com" });
    expect(res.status).toBe(500);
  });
});
