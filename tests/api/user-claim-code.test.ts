import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * #303 — `POST /api/user/claim-code` était un oracle de force brute : aucun
 * quota, et une recherche par SUFFIXE sur toute saisie de 5 caractères ou
 * moins (20 bits d'entropie, 1 048 576 combinaisons). Ces tests figent le
 * comportement corrigé : quota fail-closed, correspondance exacte, plancher
 * de longueur, réponse unique, et interdiction statique du motif `endsWith`.
 */

const db = vi.hoisted(() => ({
  attestationFindFirst: vi.fn(),
  attestationUpdate: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findFirst: db.attestationFindFirst,
      update: db.attestationUpdate,
    },
    user: { update: db.userUpdate },
    $transaction: db.transaction,
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { POST } from "../../app/api/user/claim-code/route";
import {
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

/** Code au format réellement émis par `lib/attestations/issue.ts` (25 caractères). */
const VALID_CODE = "FSA-2026-M01-00042-a3f9c";

/** Fragment de 5 caractères : l'ancien oracle (20 bits). */
const SHORT_FRAGMENT = "a3f9c";

function callClaimCode(body: unknown, ip = "203.0.113.7") {
  return POST(
    new Request("http://localhost/api/user/claim-code", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Identité stable : le seau IP du quota est ainsi déterministe.
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: VALID_CODE,
    fullName: "Alice Dupont",
    birthDate: new Date("2000-01-02T00:00:00.000Z"),
    birthPlace: "Doualo",
    gender: "F",
    ...overrides,
  };
}

/** Source de la route, commentaires retirés (le motif ne doit pas être exécutable). */
function routeExecutableSource(): string {
  return readFileSync(
    resolve(__dirname, "../../app/api/user/claim-code/route.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const originalLimits = { ...memoryFallbackLimits };

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1", role: "user" } as never);
  db.attestationFindFirst.mockResolvedValue(makeAttestation() as never);
  db.transaction.mockResolvedValue([] as never);
  db.attestationUpdate.mockResolvedValue({} as never);
  db.userUpdate.mockResolvedValue({} as never);
});

afterEach(() => {
  Object.assign(memoryFallbackLimits, originalLimits);
  vi.unstubAllEnvs();
});

describe("POST /api/user/claim-code — contrôle d'accès", () => {
  it("401 si non authentifié", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(401);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("403 si l'utilisateur est administrateur", async () => {
    deps.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
    } as never);
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(403);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("400 si le code est trop court", async () => {
    const res = await callClaimCode({ codePart: "AB" });
    expect(res.status).toBe(400);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });
});

describe("#303 — le fragment de code court n'est plus un oracle", () => {
  it("refuse un fragment de 5 caractères sans jamais interroger la base", async () => {
    const res = await callClaimCode({ codePart: SHORT_FRAGMENT });
    expect(res.status).toBe(400);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("refuse aussi un fragment légèrement plus long (7 caractères)", async () => {
    const res = await callClaimCode({ codePart: "00a3f9c" });
    expect(res.status).toBe(400);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("n'expose jamais un code « existant » vs « absent » par le statut du 400", async () => {
    // Le 400 ne dépend QUE de la longueur : le corps de la réponse est donc
    // identique que le fragment corresponde ou non à une attestation.
    const premier = await callClaimCode({ codePart: SHORT_FRAGMENT });
    const second = await callClaimCode({ codePart: "0f0f0" });
    expect(premier.status).toBe(400);
    expect(second.status).toBe(400);
    expect(await premier.json()).toEqual(await second.json());
  });
});

describe("#303 — correspondance exacte du code", () => {
  it("code complet → recherche exacte et liaison atomique", async () => {
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.fullName).toBe("Alice Dupont");
    expect(db.attestationFindFirst).toHaveBeenCalledWith({
      where: { code: VALID_CODE, userId: null, status: "VALIDATED" },
    });
    expect(db.transaction).toHaveBeenCalled();
    expect(db.attestationUpdate).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { userId: "user-1" },
    });
    expect(db.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });

  it("remet la saisie dans la forme stockée, quelle que soit la casse", async () => {
    const res = await callClaimCode({ codePart: VALID_CODE.toUpperCase() });
    expect(res.status).toBe(200);
    expect(db.attestationFindFirst).toHaveBeenCalledWith({
      where: { code: VALID_CODE, userId: null, status: "VALIDATED" },
    });
  });

  it("n'exécute qu'une seule requête, et jamais une recherche partielle", async () => {
    await callClaimCode({ codePart: VALID_CODE });
    expect(db.attestationFindFirst).toHaveBeenCalledTimes(1);
    const [{ where }] = db.attestationFindFirst.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    // Une égalité sur `code`, pas un motif : `endsWith`/`startsWith`/`contains`
    // réduiraient l'espace de recherche à quelques bits.
    expect(where.code).toBe(VALID_CODE);
    expect(typeof where.code).toBe("string");
  });

  it("404 si aucune attestation ne correspond, sans rien modifier", async () => {
    db.attestationFindFirst.mockResolvedValue(null as never);
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(404);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("un code inconnu et un code déjà lié rendent exactement la même réponse", async () => {
    // Le filtre `userId: null` de la requête fait qu'un code déjà rattaché est
    // indistinguable d'un code inexistant : ni statut, ni corps, ni requête
    // supplémentaire ne doivent diverger.
    db.attestationFindFirst.mockResolvedValue(null as never);
    const inconnu = await callClaimCode({ codePart: "FSA-2026-M01-99999-fffff" });
    const dejaLie = await callClaimCode({ codePart: VALID_CODE });

    expect(inconnu.status).toBe(404);
    expect(dejaLie.status).toBe(inconnu.status);
    expect(await dejaLie.json()).toEqual(await inconnu.json());
    for (const call of db.attestationFindFirst.mock.calls) {
      expect((call[0] as { where: Record<string, unknown> }).where).toEqual({
        code: expect.any(String),
        userId: null,
        status: "VALIDATED",
      });
    }
  });

  it("500 si la recherche échoue", async () => {
    db.attestationFindFirst.mockRejectedValue(new Error("db down") as never);
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(500);
  });
});

describe("#303 — quota fail-closed sur la réclamation par code", () => {
  it("déclare un quota cohérent avec les autres devinettes de secret", () => {
    // 10 tentatives / 15 min : même fenêtre que `login` et `fsaOtpVerify`,
    // budget doublé car l'entrée légitime est un code de 25 caractères saisi
    // à la main. Tout de même bien plus strict que le quota d'API (100/min).
    expect(memoryFallbackLimits.claimCode).toEqual({ max: 10, windowMs: 900_000 });
  });

  it("un claim normal passe", async () => {
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(200);
    expect(db.transaction).toHaveBeenCalled();
  });

  it("refuse (429) au-delà du quota et n'interroge plus la base", async () => {
    memoryFallbackLimits.claimCode = { max: 3, windowMs: 60 * 60_000 };
    for (let i = 0; i < 3; i++) {
      expect((await callClaimCode({ codePart: VALID_CODE })).status).toBe(200);
    }
    const blocked = await callClaimCode({ codePart: "FSA-2026-M01-00043-b0b0b" });
    expect(blocked.status).toBe(429);
    expect(db.attestationFindFirst).toHaveBeenCalledTimes(3);
    expect(db.transaction).toHaveBeenCalledTimes(3);
  });

  it("compte IP ET utilisateur : changer d'IP ne repousse pas le quota", async () => {
    memoryFallbackLimits.claimCode = { max: 2, windowMs: 60 * 60_000 };
    await callClaimCode({ codePart: VALID_CODE }, "10.0.0.1");
    await callClaimCode({ codePart: VALID_CODE }, "10.0.0.2");
    const blocked = await callClaimCode({ codePart: VALID_CODE }, "10.0.0.3");
    expect(blocked.status).toBe(429);
  });

  it("le spoofing de x-forwarded-for ne crée pas de nouveau seau", async () => {
    memoryFallbackLimits.claimCode = { max: 2, windowMs: 60 * 60_000 };
    await callClaimCode({ codePart: VALID_CODE }, "1.2.3.4, 203.0.113.7");
    await callClaimCode({ codePart: VALID_CODE }, "5.6.7.8, 203.0.113.7");
    expect(
      (await callClaimCode({ codePart: VALID_CODE }, "9.9.9.9, 203.0.113.7")).status,
    ).toBe(429);
  });

  it("le quota s'applique après l'authentification (401 si pas de session)", async () => {
    memoryFallbackLimits.claimCode = { max: 1, windowMs: 60 * 60_000 };
    deps.getCurrentUser.mockResolvedValue(null as never);
    expect((await callClaimCode({ codePart: VALID_CODE })).status).toBe(401);
  });

  it("fail-closed : sans Redis, la réclamation est refusée (503) en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
    const res = await callClaimCode({ codePart: VALID_CODE });
    expect(res.status).toBe(503);
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe("#303 — garde statique anti-régression", () => {
  it("la route n'expose plus aucun motif de recherche partielle", () => {
    const source = routeExecutableSource();
    for (const motif of ["endsWith", "startsWith", "contains"]) {
      expect(source, `la route ne doit plus utiliser ${motif}`).not.toContain(motif);
    }
  });

  it("la route filtre le code par égalité stricte", () => {
    const source = routeExecutableSource();
    expect(source).toMatch(/code:\s*sanitizedCode\s*,/);
    expect(source).toMatch(/userId:\s*null/);
    expect(source).toMatch(/status:\s*"VALIDATED"/);
  });

  it("la route applique bien le quota `claimCode` avant tout accès à la base", () => {
    const source = routeExecutableSource();
    expect(source).toContain('applyRateLimitByUser(req, user.id, "claimCode")');
    expect(source.indexOf('applyRateLimitByUser(req, user.id, "claimCode")')).toBeLessThan(
      source.indexOf("prisma.attestation.findFirst"),
    );
  });

  it("la route conserve un plancher de longueur supérieur au fragment de 5 caractères", () => {
    const source = routeExecutableSource();
    expect(source).toContain("const MIN_CODE_LENGTH = 8;");
  });
});
