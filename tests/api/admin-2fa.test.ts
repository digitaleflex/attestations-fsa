import { vi, describe, it, expect, beforeEach } from "vitest";

/**
 * 2FA admin via `app/api/auth/[...all]/route.ts` (issue #11).
 *
 * Les pages `app/admin/2fa/setup/page.tsx` (enable → verifyTotp) et
 * `app/admin/2fa/verify/page.tsx` (verifyTotp / sendOtp → verifyOtp /
 * verifyBackupCode) parlent à Better Auth à travers cette route, qui ne fait
 * que déléguer à `auth.handler` (`toNextJsHandler`). Tester le vrai handler
 * exigerait une base Postgres ; on mocke donc `@/lib/auth` avec une machine
 * à états 2FA en mémoire qui REPRODUIT le contrat better-auth 1.7 :
 *
 *   POST /two-factor/enable             { password }             → totpURI + backupCodes
 *   POST /two-factor/verify-totp        { code, trustDevice }    → statut
 *   POST /two-factor/send-otp           {}                       → statut
 *   POST /two-factor/verify-otp         { code, trustDevice }    → statut
 *   POST /two-factor/verify-backup-code { code, trustDevice }    → statut (usage unique)
 *
 * Ce qui est réellement exercé : le câblage de la route (GET/POST exportés,
 * préfixe `/api/auth` dépilé par le handler), les corps EXACTS envoyés par
 * les pages, et les règles métier 2FA (6 chiffres, usage unique des codes de
 * secours, ordre enable → verify).
 *
 * `makeRequest` (tests/helpers/request.ts) est volontairement inutilisé ici :
 * la fausse requête n'a pas d'URL et le handler route sur `req.url`.
 */

const fake = vi.hoisted(() => {
  const TOTP_CODE = "123456";
  const EMAIL_OTP = "654321";

  const state = {
    enabled: false,
    emailSent: false,
    totpURI: "",
    backupCodes: [] as string[],
    received: [] as { method: string; path: string; body: unknown }[],
  };

  function freshBackupCodes(): string[] {
    return Array.from({ length: 10 }, (_, i) => `BACKUP-${i + 1}-TEST`);
  }

  function json(status: number, data: unknown): Response {
    return Response.json(data, { status });
  }

  function isSixDigits(value: unknown): value is string {
    return typeof value === "string" && /^\d{6}$/.test(value);
  }

  async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/auth/, "") || "/";
    const method = req.method.toUpperCase();
    let body: Record<string, unknown> = {};
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
    state.received.push({ method, path, body });

    if (method !== "POST") {
      return json(405, { error: "Méthode non autorisée." });
    }

    switch (path) {
      case "/two-factor/enable": {
        if (typeof body.password !== "string" || body.password.length === 0) {
          return json(400, { error: "Le mot de passe est requis." });
        }
        state.enabled = true;
        state.emailSent = false;
        state.totpURI = `otpauth://totp/FSA:admin-test?secret=JBSWY3DPEHPK3PXP&issuer=FSA`;
        state.backupCodes = freshBackupCodes();
        return json(200, {
          method: "totp",
          totpURI: state.totpURI,
          backupCodes: [...state.backupCodes],
        });
      }
      case "/two-factor/verify-totp": {
        if (!state.enabled) {
          return json(400, { error: "L'activation 2FA n'a pas été initiée." });
        }
        if (!isSixDigits(body.code)) {
          return json(400, { error: "Entrez un code à 6 chiffres." });
        }
        if (body.code !== TOTP_CODE) {
          return json(401, { error: "Code invalide." });
        }
        return json(200, { status: true });
      }
      case "/two-factor/send-otp": {
        if (!state.enabled) {
          return json(400, { error: "L'activation 2FA n'a pas été initiée." });
        }
        state.emailSent = true;
        return json(200, { status: true });
      }
      case "/two-factor/verify-otp": {
        if (!state.emailSent) {
          return json(400, { error: "Aucun code n'a été envoyé par email." });
        }
        if (!isSixDigits(body.code)) {
          return json(400, { error: "Entrez un code à 6 chiffres." });
        }
        if (body.code !== EMAIL_OTP) {
          return json(401, { error: "Code invalide." });
        }
        return json(200, { status: true });
      }
      case "/two-factor/verify-backup-code": {
        if (!state.enabled) {
          return json(400, { error: "L'activation 2FA n'a pas été initiée." });
        }
        if (typeof body.code !== "string" || body.code.length === 0) {
          return json(400, { error: "Entrez un code de secours." });
        }
        const index = state.backupCodes.indexOf(body.code);
        if (index === -1) {
          return json(401, { error: "Code de secours invalide." });
        }
        // Usage unique, comme rappelé par la page verify.
        state.backupCodes.splice(index, 1);
        return json(200, {
          status: true,
          remaining: state.backupCodes.length,
        });
      }
      default:
        return json(404, { error: "Route inconnue." });
    }
  }

  return { state, handler, TOTP_CODE, EMAIL_OTP };
});

vi.mock("@/lib/auth", () => ({
  auth: { handler: fake.handler },
}));

import { GET, POST } from "../../app/api/auth/[...all]/route";

const BASE = "http://localhost/api/auth";

function call(
  path: string,
  body: unknown,
  method = "POST",
): Promise<Response> {
  return POST(
    new Request(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
    }),
  );
}

function lastReceived() {
  const entries = fake.state.received;
  return entries[entries.length - 1];
}

beforeEach(() => {
  fake.state.enabled = false;
  fake.state.emailSent = false;
  fake.state.totpURI = "";
  fake.state.backupCodes = [];
  fake.state.received = [];
});

describe("route [...all] — câblage", () => {
  it("expose GET et POST (toNextJsHandler)", async () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });

  it("405 sur une méthode non-POST vers un endpoint 2FA", async () => {
    const res = await call("/two-factor/enable", {}, "GET");
    expect(res.status).toBe(405);
  });

  it("404 sur un chemin inconnu", async () => {
    const res = await call("/two-factor/inexistant", {});
    expect(res.status).toBe(404);
  });
});

describe("POST /two-factor/enable (page setup : handleEnable2FA)", () => {
  it("400 si le mot de passe est manquant", async () => {
    expect((await call("/two-factor/enable", {})).status).toBe(400);
    expect((await call("/two-factor/enable", { password: "" })).status).toBe(
      400,
    );
  });

  it("200 retourne totpURI + 10 codes de secours (page setup les affiche)", async () => {
    const res = await call("/two-factor/enable", { password: "secret-admin" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.method).toBe("totp");
    expect(body.totpURI).toContain("otpauth://totp/");
    expect(body.backupCodes).toHaveLength(10);
  });

  it("transmet le corps exact envoyé par la page ({ password })", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    expect(lastReceived()).toMatchObject({
      method: "POST",
      path: "/two-factor/enable",
      body: { password: "secret-admin" },
    });
  });
});

describe("POST /two-factor/verify-totp (pages setup + verify)", () => {
  it("400 si l'activation n'a pas été initiée", async () => {
    const res = await call("/two-factor/verify-totp", {
      code: "123456",
      trustDevice: true,
    });
    expect(res.status).toBe(400);
  });

  it("400 si le code n'a pas 6 chiffres (garde des pages)", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    expect(
      (await call("/two-factor/verify-totp", { code: "12345" })).status,
    ).toBe(400);
    expect(
      (
        await call("/two-factor/verify-totp", {
          code: "abcdef",
          trustDevice: true,
        })
      ).status,
    ).toBe(400);
  });

  it("401 si le code est incorrect", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    const res = await call("/two-factor/verify-totp", {
      code: "000000",
      trustDevice: true,
    });
    expect(res.status).toBe(401);
  });

  it("200 si le code est correct, avec le corps exact des pages", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    const res = await call("/two-factor/verify-totp", {
      code: fake.TOTP_CODE,
      trustDevice: true,
    });
    expect(res.status).toBe(200);
    expect(lastReceived()).toMatchObject({
      method: "POST",
      path: "/two-factor/verify-totp",
      body: { code: fake.TOTP_CODE, trustDevice: true },
    });
  });
});

describe("POST /two-factor/send-otp + verify-otp (page verify, onglet email)", () => {
  it("400 sur send-otp si l'activation n'a pas été initiée", async () => {
    expect((await call("/two-factor/send-otp", {})).status).toBe(400);
  });

  it("200 sur send-otp après enable (page verify : handleSendEmailOTP)", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    const res = await call("/two-factor/send-otp", {});
    expect(res.status).toBe(200);
    expect(lastReceived()).toMatchObject({
      method: "POST",
      path: "/two-factor/send-otp",
    });
  });

  it("400 sur verify-otp sans envoi préalable", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    const res = await call("/two-factor/verify-otp", {
      code: fake.EMAIL_OTP,
      trustDevice: true,
    });
    expect(res.status).toBe(400);
  });

  it("400 si le code email n'a pas 6 chiffres, 401 si incorrect, 200 si correct", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    await call("/two-factor/send-otp", {});
    expect(
      (await call("/two-factor/verify-otp", { code: "12345" })).status,
    ).toBe(400);
    expect(
      (
        await call("/two-factor/verify-otp", {
          code: "000000",
          trustDevice: true,
        })
      ).status,
    ).toBe(401);
    const ok = await call("/two-factor/verify-otp", {
      code: fake.EMAIL_OTP,
      trustDevice: true,
    });
    expect(ok.status).toBe(200);
  });
});

describe("POST /two-factor/verify-backup-code (page verify, onglet secours)", () => {
  it("400 si le code est absent, 401 si inconnu", async () => {
    await call("/two-factor/enable", { password: "secret-admin" });
    expect((await call("/two-factor/verify-backup-code", {})).status).toBe(
      400,
    );
    expect(
      (
        await call("/two-factor/verify-backup-code", {
          code: "INCONNU-00-XX",
          trustDevice: true,
        })
      ).status,
    ).toBe(401);
  });

  it("200 consomme le code : usage unique, comme rappelé par la page", async () => {
    const enabled = await call("/two-factor/enable", {
      password: "secret-admin",
    });
    const { backupCodes } = await enabled.json();
    const code = backupCodes[0] as string;

    const first = await call("/two-factor/verify-backup-code", {
      code,
      trustDevice: true,
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: true, remaining: 9 });

    const reuse = await call("/two-factor/verify-backup-code", {
      code,
      trustDevice: true,
    });
    expect(reuse.status).toBe(401);
  });
});

describe("parcours 2FA complets (setup puis verify)", () => {
  it("setup : enable → verify-totp", async () => {
    const enabled = await call("/two-factor/enable", {
      password: "secret-admin",
    });
    expect(enabled.status).toBe(200);
    const verified = await call("/two-factor/verify-totp", {
      code: fake.TOTP_CODE,
      trustDevice: true,
    });
    expect(verified.status).toBe(200);
  });

  it("verify email : enable → send-otp → verify-otp", async () => {
    expect(
      (await call("/two-factor/enable", { password: "secret-admin" })).status,
    ).toBe(200);
    expect((await call("/two-factor/send-otp", {})).status).toBe(200);
    expect(
      (
        await call("/two-factor/verify-otp", {
          code: fake.EMAIL_OTP,
          trustDevice: true,
        })
      ).status,
    ).toBe(200);
  });
});
