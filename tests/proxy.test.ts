import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests de la couche d'autorisation Edge `proxy.ts`.
 *
 * Rappel d'architecture : ce middleware ne fait AUCUNE requête DB. Il applique
 * un pré-filtre optimiste :
 *   1. ignore les routes techniques/publiques ;
 *   2. classe la route en ADMIN / USER / publique ;
 *   3. pour une route privée, exige un cookie de session PLAUSIBLE ;
 *   4. laisse la validation réelle (rôle, expiration) au Layout/route API.
 *
 * Le rôle `ADMIN` vs `USER` n'est donc PAS évalué ici : un cookie plausible
 * passe sur `/admin` comme sur `/dashboard`.
 */
import proxy, { isPlausibleSessionToken, config } from "@/proxy";

/** Token de session suffisamment long pour être jugé plausible. */
const VALID_TOKEN = "valid-session-token-value-1234567890";

/**
 * Construit une NextRequest pour un pathname donné.
 * `cookieValue === undefined` => aucun cookie de session n'est envoyé.
 */
function makeRequest(
  pathname: string,
  cookieValue?: string,
  cookieName = "better-auth.session_token",
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  if (cookieValue === undefined) {
    return new NextRequest(url);
  }
  return new NextRequest(url, {
    headers: { cookie: `${cookieName}=${cookieValue}` },
  });
}

describe("isPlausibleSessionToken - garde-fou sans DB", () => {
  it("rejette les valeurs absentes, vides ou manifestement fausses", () => {
    expect(isPlausibleSessionToken(null)).toBe(false);
    expect(isPlausibleSessionToken(undefined)).toBe(false);
    expect(isPlausibleSessionToken("")).toBe(false);
    expect(isPlausibleSessionToken("   ")).toBe(false);
    expect(isPlausibleSessionToken("abc")).toBe(false);
    expect(isPlausibleSessionToken("null")).toBe(false);
    expect(isPlausibleSessionToken("undefined")).toBe(false);
  });

  it("accepte un token suffisamment long et non réservé", () => {
    expect(isPlausibleSessionToken(VALID_TOKEN)).toBe(true);
  });
});

describe("proxy - routes techniques et publiques", () => {
  it.each([
    "/_next/static/chunk.js",
    "/api/auth/sign-in",
    "/api/public/internships",
    "/favicon.ico",
  ])("laisse passer %s sans session", async (pathname) => {
    const res = await proxy(makeRequest(pathname));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("laisse passer une route publique non privée", async () => {
    const res = await proxy(makeRequest("/a-propos"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy - route ADMIN sans session", () => {
  it("redirige vers /admin/login avec callbackUrl", async () => {
    const res = await proxy(makeRequest("/admin/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/admin/login?callbackUrl=%2Fadmin%2Fdashboard",
    );
  });

  it("répond 401 JSON pour une API admin au lieu de rediriger", async () => {
    const res = await proxy(makeRequest("/api/admin/users"));
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
    await expect(res.json()).resolves.toEqual({
      message: "Non autorisé",
      code: "UNAUTHORIZED",
    });
  });

  it.each(["/admin/login", "/admin/register", "/admin/signup"])(
    "laisse passer la page d'auth admin %s sans session",
    async (pathname) => {
      const res = await proxy(makeRequest(pathname));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );
});

describe("proxy - route USER sans session", () => {
  it("redirige vers /auth avec callbackUrl", async () => {
    const res = await proxy(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/auth?callbackUrl=%2Fdashboard",
    );
  });

  it("répond 401 JSON pour une API user au lieu de rediriger", async () => {
    const res = await proxy(makeRequest("/api/user/profile"));
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
    await expect(res.json()).resolves.toEqual({
      message: "Non autorisé",
      code: "UNAUTHORIZED",
    });
  });
});

describe("proxy - valeur du cookie de session", () => {
  it("accepte le cookie primaire better-auth.session_token", async () => {
    const res = await proxy(makeRequest("/dashboard", VALID_TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("accepte le cookie de secours __Secure-better-auth.session_token", async () => {
    const res = await proxy(
      makeRequest("/dashboard", VALID_TOKEN, "__Secure-better-auth.session_token"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it.each([["abc"], ["null"], ["undefined"], ["   "]])(
    "traite un cookie non plausible comme absent (valeur: %s)",
    async (value) => {
      const res = await proxy(makeRequest("/dashboard", value));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "http://localhost:3000/auth?callbackUrl=%2Fdashboard",
      );
    },
  );

  it("traite un cookie vide comme absent", async () => {
    const res = await proxy(makeRequest("/dashboard", ""));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/auth?callbackUrl=%2Fdashboard",
    );
  });
});

describe("proxy - utilisateur authentifié (contrôle de rôle délégué à la DB)", () => {
  it("laisse passer un cookie plausible sur une route ADMIN", async () => {
    // Le proxy est optimiste : il ne connaît pas le rôle. Un cookie plausible
    // passe, puis le Layout/route API rejette un non-admin (cf. lib/api-auth).
    const res = await proxy(makeRequest("/admin", VALID_TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("ne redirige PAS un utilisateur authentifié depuis /admin/login", async () => {
    // Aucune logique d'inversion (session valide => renvoi vers l'espace) :
    // les pages /admin/login|register|signup passent toujours.
    const res = await proxy(makeRequest("/admin/login", VALID_TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy - configuration du matcher", () => {
  it("expose un tableau matcher non vide", () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
    expect(config.matcher[0]).toContain("_next/static");
  });
});
