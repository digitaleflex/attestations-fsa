import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * #303 — `POST /api/auth/fsa-login` était un DEUXIÈME oracle de force brute sur
 * le même secret que `/api/user/claim-code` : toute saisie de 5 caractères
 * déclenchait une recherche par SUFFIXE (`code.endsWith("-xxxxx")`), donc un
 * espace de recherche de 20 bits — 1 048 576 combinaisons — sur les
 * attestations VALIDATED. Le quota existant (3/10min par IP) n'était qu'une
 * limitation de débit sur cet espace, et il était de surcroît fail-OPEN
 * (`if (limiter)`, IP lue dans un `x-forwarded-for` spinnable).
 *
 * Ces tests figent le comportement corrigé, aligné sur `/api/user/claim-code` :
 * refus des fragments, correspondance exacte, canonisation de la forme FSA,
 * réponse indifférenciée, quotas fail-closed, et interdiction statique du
 * motif de recherche partielle.
 */

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

import { POST } from "../../app/api/auth/fsa-login/route";
import {
  memoryFallbackLimits,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";
import { makeRequest } from "../helpers/request";

/** Code au format réellement émis par `lib/attestations/issue.ts` (25 caractères). */
const VALID_CODE = "FSA-2026-M01-00042-f0f9a";

/** Fragment de 5 caractères : l'ancien oracle (20 bits). */
const SHORT_FRAGMENT = "f0f9a";

const CANDIDATE_EMAIL = "alice@example.com";

function authResponse(ok: boolean, status = 200, cookies: string[] = []) {
  return { ok, status, headers: { getSetCookie: () => cookies } };
}

function call(body: unknown, ip = "203.0.113.7") {
  return POST(makeRequest(body, { "x-forwarded-for": ip }));
}

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: VALID_CODE,
    email: CANDIDATE_EMAIL,
    fullName: "Alice Dupont",
    userId: null,
    ...overrides,
  };
}

/** Source de la route, commentaires retirés (le motif ne doit pas être exécutable). */
function routeExecutableSource(): string {
  return readFileSync(
    resolve(__dirname, "../../app/api/auth/fsa-login/route.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const originalLimits = { ...memoryFallbackLimits };

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.clearAllMocks();
  db.userFindUnique.mockResolvedValue({
    id: "user-1",
    email: CANDIDATE_EMAIL,
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

afterEach(() => {
  Object.assign(memoryFallbackLimits, originalLimits);
  vi.unstubAllEnvs();
});

describe("POST /api/auth/fsa-login — validation", () => {
  it("400 si le payload ne correspond à aucune action", async () => {
    const res = await call({ action: "inconnue" });
    expect(res.status).toBe(400);
  });

  it("400 si le code FSA est vide", async () => {
    const res = await call({ action: "request-otp", fsaCode: "" });
    expect(res.status).toBe(400);
    expect(db.attestationFindUnique).not.toHaveBeenCalled();
  });

  it("400 si l'identifiant est trop long", async () => {
    const res = await call({ action: "request-otp", fsaCode: "a".repeat(51) });
    expect(res.status).toBe(400);
  });

  it("400 si le code OTP de vérification n'a pas 6 chiffres", async () => {
    const res = await call({
      action: "verify-otp",
      fsaCode: VALID_CODE,
      otp: "12345",
    });
    expect(res.status).toBe(400);
  });
});

describe("#303 — le fragment de code n'est plus un oracle", () => {
  it("refuse un fragment de 5 caractères sans jamais interroger la base", async () => {
    const res = await call({ action: "request-otp", fsaCode: SHORT_FRAGMENT });
    expect(res.status).toBe(400);
    expect(db.attestationFindUnique).not.toHaveBeenCalled();
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("refuse aussi un fragment légèrement plus long (7 caractères)", async () => {
    const res = await call({ action: "request-otp", fsaCode: "00f0f9a" });
    expect(res.status).toBe(400);
    expect(db.attestationFindUnique).not.toHaveBeenCalled();
  });

  it("refuse le fragment sur l'action verify-otp également", async () => {
    const res = await call({
      action: "verify-otp",
      fsaCode: SHORT_FRAGMENT,
      otp: "123456",
    });
    expect(res.status).toBe(400);
    expect(authApi.signInEmailOTP).not.toHaveBeenCalled();
  });

  it("n'expose rien sur un fragment, qu'il existe ou non en base", async () => {
    // Le 400 ne dépend QUE de la FORME de la saisie : rien dans la réponse ne
    // permet d'apprendre si le fragment correspond à une attestation.
    db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
    const premier = await call({ action: "request-otp", fsaCode: SHORT_FRAGMENT });
    db.attestationFindUnique.mockResolvedValue(null as never);
    const second = await call({ action: "request-otp", fsaCode: "0f0f0" });
    expect(premier.status).toBe(400);
    expect(second.status).toBe(400);
    expect(await premier.json()).toEqual(await second.json());
  });
});

describe("#303 — correspondance exacte du code", () => {
  it("code complet → recherche exacte sur la colonne unique", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
    const res = await call({ action: "request-otp", fsaCode: VALID_CODE });
    expect(res.status).toBe(200);
    expect(db.attestationFindUnique).toHaveBeenCalledWith({
      where: { code: VALID_CODE },
    });
    expect(db.attestationFindFirst).not.toHaveBeenCalled();
  });

  it("remet la saisie dans la forme stockée, quelle que soit la casse", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
    const res = await call({ action: "request-otp", fsaCode: VALID_CODE.toUpperCase() });
    expect(res.status).toBe(200);
    expect(db.attestationFindUnique).toHaveBeenCalledWith({
      where: { code: VALID_CODE },
    });
  });

  it("tolère les espaces autour de la saisie", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
    const res = await call({
      action: "request-otp",
      fsaCode: `  ${VALID_CODE}  `,
    });
    expect(res.status).toBe(200);
    expect(db.attestationFindUnique).toHaveBeenCalledWith({
      where: { code: VALID_CODE },
    });
  });

  it("n'exécute qu'une seule requête, et jamais une recherche partielle", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
    await call({ action: "request-otp", fsaCode: VALID_CODE });
    expect(db.attestationFindUnique).toHaveBeenCalledTimes(1);
    const [{ where }] = db.attestationFindUnique.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    // Une égalité sur `code`, pas un motif : `endsWith`/`startsWith`/`contains`
    // réduiraient l'espace de recherche à quelques bits.
    expect(where.code).toBe(VALID_CODE);
    expect(typeof where.code).toBe("string");
  });
});

describe("#303 — réponses indifférenciées (aucune énumération)", () => {
  it("un code inconnu, un dossier sans e-mail et un e-mail inconnu rendent la même réponse", async () => {
    db.attestationFindUnique.mockResolvedValue(null as never);
    const codeInconnu = await call({ action: "request-otp", fsaCode: VALID_CODE });
    const codeInconnuStatus = codeInconnu.status;
    const codeInconnuBody = await codeInconnu.json();

    // INVERSION : l'ancien test figeait 400 « aucune adresse e-mail », un statut
    // qui révélait à lui seul l'existence du code. Dorénavant 404 identique.
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ email: null }) as never,
    );
    const dossierSansEmail = await call({ action: "request-otp", fsaCode: VALID_CODE });

    db.userFindUnique.mockResolvedValue(null as never);
    const emailInconnu = await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL });

    expect(codeInconnuStatus).toBe(404);
    for (const res of [dossierSansEmail, emailInconnu]) {
      expect(res.status).toBe(codeInconnuStatus);
      expect(await res.json()).toEqual(codeInconnuBody);
    }
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("un dossier sans e-mail ne déclenche aucun envoi d'OTP", async () => {
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ email: null }) as never,
    );
    const res = await call({ action: "request-otp", fsaCode: VALID_CODE });
    expect(res.status).toBe(404);
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/fsa-login — request-otp", () => {
  it("404 si l'email n'est associé à aucun compte", async () => {
    db.userFindUnique.mockResolvedValue(null as never);
    const res = await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL });
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
    db.attestationFindUnique.mockResolvedValue(null as never);
    const res = await call({ action: "request-otp", fsaCode: VALID_CODE });
    expect(res.status).toBe(404);
  });

  it("200 envoie l'OTP et masque l'email", async () => {
    const res = await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.emailMasked).toBe("al***e@example.com");
    expect(body.name).toBe("Alice");
  });

  it("200 pour un code FSA complet, et l'OTP part vers l'e-mail du dossier", async () => {
    db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
    const res = await call({ action: "request-otp", fsaCode: VALID_CODE });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(authApi.sendVerificationOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: CANDIDATE_EMAIL, type: "sign-in" },
      }),
    );
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

  it("401 si le code OTP est invalide", async () => {
    authApi.signInEmailOTP.mockResolvedValue(authResponse(false, 401) as never);
    const res = await call({
      action: "verify-otp",
      fsaCode: CANDIDATE_EMAIL,
      otp: "000000",
    });
    expect(res.status).toBe(401);
  });

  it("200 crée la session et renvoie le rôle", async () => {
    const res = await call({
      action: "verify-otp",
      fsaCode: CANDIDATE_EMAIL,
      otp: "123456",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.role).toBe("user");
  });

  it("associe l'attestation trouvée à l'utilisateur connecté", async () => {
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ userId: "ancien-user" }) as never,
    );
    const res = await call({
      action: "verify-otp",
      fsaCode: VALID_CODE,
      otp: "123456",
    });
    expect(res.status).toBe(200);
    expect(db.attestationUpdate).toHaveBeenCalledWith({
      where: { id: "att-1" },
      data: { userId: "user-1" },
    });
  });

  it("un code FSA complet reste un mode de connexion fonctionnel", async () => {
    // Non-régression : le login par code COMPLET doit toujours fonctionner.
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ userId: "user-1" }) as never,
    );
    const res = await call({
      action: "verify-otp",
      fsaCode: VALID_CODE,
      otp: "123456",
    });
    expect(res.status).toBe(200);
    expect(authApi.signInEmailOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: CANDIDATE_EMAIL, otp: "123456" },
      }),
    );
    // Déjà rattaché : aucune écriture inutile.
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/fsa-login — autres actions", () => {
  it("410 : le magic link est désactivé", async () => {
    const res = await call({
      action: "request-magic-link",
      fsaCode: CANDIDATE_EMAIL,
    });
    expect(res.status).toBe(410);
  });

  it("500 si une erreur fatale survient", async () => {
    authApi.sendVerificationOTP.mockRejectedValue(new Error("boom") as never);
    const res = await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL });
    expect(res.status).toBe(500);
  });
});

describe("#303 — quotas fail-closed sur la connexion par code", () => {
  it("déclare les quotas existants (aucun type de limite inventé)", () => {
    // Les deux types sont DÉJÀ déclarés fail-closed dans `lib/rate-limit`
    // (FAIL_CLOSED_LIMIT_TYPES) : la route ne fait plus qu'appeler le point
    // d'entrée qui applique cette politique.
    expect(memoryFallbackLimits.fsaOtpRequest).toEqual({
      max: 3,
      windowMs: 600_000,
    });
    expect(memoryFallbackLimits.fsaOtpVerify).toEqual({
      max: 5,
      windowMs: 900_000,
    });
  });

  it("refuse (429) au-delà du quota d'envoi d'OTP et n'interroge plus la base", async () => {
    memoryFallbackLimits.fsaOtpRequest = { max: 2, windowMs: 60 * 60_000 };
    expect((await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL })).status).toBe(200);
    expect((await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL })).status).toBe(200);

    const userCallsBefore = db.userFindUnique.mock.calls.length;
    const blocked = await call({ action: "request-otp", fsaCode: VALID_CODE });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    // Aucun appelant n'est autorisé à « tester » un code après le refus : le
    // quota doit couper la route AVANT la base, pas seulement l'envoi d'e-mail.
    expect(db.userFindUnique).toHaveBeenCalledTimes(userCallsBefore);
    expect(db.attestationFindUnique).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).toHaveBeenCalledTimes(2);
  });

  it("refuse (429) au-delà du quota de vérification d'OTP", async () => {
    memoryFallbackLimits.fsaOtpVerify = { max: 2, windowMs: 60 * 60_000 };
    for (let i = 0; i < 2; i++) {
      expect(
        (await call({ action: "verify-otp", fsaCode: CANDIDATE_EMAIL, otp: "123456" }))
          .status,
      ).toBe(200);
    }
    const blocked = await call({
      action: "verify-otp",
      fsaCode: CANDIDATE_EMAIL,
      otp: "000000",
    });
    expect(blocked.status).toBe(429);
    expect(authApi.signInEmailOTP).toHaveBeenCalledTimes(2);
  });

  it("compte IP ET dossier : changer d'IP ne repousse pas le quota d'OTP", async () => {
    memoryFallbackLimits.fsaOtpVerify = { max: 2, windowMs: 60 * 60_000 };
    await call({ action: "verify-otp", fsaCode: VALID_CODE, otp: "123456" }, "10.0.0.1");
    await call({ action: "verify-otp", fsaCode: VALID_CODE, otp: "123456" }, "10.0.0.2");
    const blocked = await call(
      { action: "verify-otp", fsaCode: VALID_CODE, otp: "123456" },
      "10.0.0.3",
    );
    expect(blocked.status).toBe(429);
  });

  it("le spoofing de x-forwarded-for ne crée pas de nouveau seau", async () => {
    memoryFallbackLimits.fsaOtpRequest = { max: 2, windowMs: 60 * 60_000 };
    await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL }, "1.2.3.4, 203.0.113.7");
    await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL }, "5.6.7.8, 203.0.113.7");
    const blocked = await call(
      { action: "request-otp", fsaCode: CANDIDATE_EMAIL },
      "9.9.9.9, 203.0.113.7",
    );
    expect(blocked.status).toBe(429);
  });

  it("le quota s'applique AVANT tout accès à la base", async () => {
    memoryFallbackLimits.fsaOtpRequest = { max: 1, windowMs: 60 * 60_000 };
    expect((await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL })).status).toBe(200);
    const userCallsBefore = db.userFindUnique.mock.calls.length;
    const blocked = await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL });
    expect(blocked.status).toBe(429);
    expect(db.userFindUnique).toHaveBeenCalledTimes(userCallsBefore);
    expect(db.attestationFindUnique).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).toHaveBeenCalledTimes(1);
  });

  it("fail-closed : sans compteur distribué, la connexion est refusée (503)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
    const res = await call({ action: "request-otp", fsaCode: CANDIDATE_EMAIL });
    expect(res.status).toBe(503);
    expect(db.userFindUnique).not.toHaveBeenCalled();
    expect(db.attestationFindUnique).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("fail-closed : le refus vaut aussi pour la vérification d'OTP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");
    const res = await call({
      action: "verify-otp",
      fsaCode: VALID_CODE,
      otp: "123456",
    });
    expect(res.status).toBe(503);
    expect(authApi.signInEmailOTP).not.toHaveBeenCalled();
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
    expect(source).toMatch(/prisma\.attestation\.findUnique\(/);
    expect(source).toMatch(/where:\s*\{\s*code\s*\}/);
  });

  it("la route applique les quotas avant tout accès à la base", () => {
    const source = routeExecutableSource();
    for (const quota of [
      'applyRateLimit(request, "fsaOtpRequest")',
      '"fsaOtpVerify"',
    ]) {
      expect(source).toContain(quota);
      for (const lookup of [
        "findAttestationByCode(data.fsaCode)",
        "prisma.user.findUnique",
      ]) {
        expect(source.indexOf(quota), `${quota} doit précéder ${lookup}`).toBeLessThan(
          source.indexOf(lookup),
        );
      }
    }
  });

  it("la route ne lit plus l'IP dans un x-forwarded-for brut", () => {
    // Un seau d'IP lue dans un en-tête piloté par le client se forge à chaque
    // requête : le quota ne valait alors plus rien.
    const source = routeExecutableSource();
    expect(source).not.toContain('headers.get("x-forwarded-for")');
  });

  it("la route conserve un plancher de longueur supérieur au fragment de 5 caractères", () => {
    const source = routeExecutableSource();
    expect(source).toContain("const MIN_CODE_LENGTH = 8;");
  });

  it("la route ne promet plus un identifiant de 5 caractères", () => {
    const source = routeExecutableSource();
    expect(source).not.toContain("au moins 5 caractères");
  });
});
