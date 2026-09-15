// Sondes runtime de la porte de sortie (#155) — exerce le HANDLER RÉEL de
// /api/ready (import + appel direct, pas de serveur) et prouve le contrat
// « prod : scellement bruyant / dev-test : tolérant ».
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const db = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: db.queryRaw },
}));

import { GET as readyGET } from "../../app/api/ready/route";
import { GET as healthGET } from "../../app/api/health/route";
import {
  canonicalizeSealPayload,
  computeSealHash,
  getSealSecret,
  sealCertificate,
  verifyCertificateSeal,
  type CertificateSealPayload,
} from "@/lib/crypto/seal";

const VALID_SECRET = "ready-probe-secret-0123456789abcdef";

const payload: CertificateSealPayload = {
  code: "FSA-2026-M09-00042-abcde",
  fullName: "Alice Doe",
  formationName: "Pisciculture",
  certificationScore: 88,
  certificationMention: "TRES_BIEN",
  endDate: new Date("2026-09-01T10:00:00Z"),
};

interface ReadyBody {
  status: string;
  checks: {
    database: string;
    seal: string;
    sealReason: string | null;
    sealRequired: boolean;
  };
}

async function readyBody(res: Response): Promise<ReadyBody> {
  return (await res.json()) as ReadyBody;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  delete process.env.CERT_SEAL_SECRET;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete process.env.CERT_SEAL_SECRET;
});

describe("GET /api/ready — sonde de scellement (#155)", () => {
  it("prod SANS clé → 503 + diagnostic exploitable", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await readyGET();

    expect(res.status).toBe(503);
    const body = await readyBody(res);
    expect(body.status).toBe("unready");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.seal).toBe("missing");
    expect(body.checks.sealRequired).toBe(true);
    expect(body.checks.sealReason).toContain("CERT_SEAL_SECRET");
    expect(body.checks.sealReason).toContain("absent");
  });

  it("prod AVEC clé valide (>= 16) → 200", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CERT_SEAL_SECRET", VALID_SECRET);

    const res = await readyGET();

    expect(res.status).toBe(200);
    const body = await readyBody(res);
    expect(body.status).toBe("ready");
    expect(body.checks.seal).toBe("ok");
    expect(body.checks.sealReason).toBeNull();
  });

  it("hors production SANS clé → 200 + seal=disabled", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const res = await readyGET();

    expect(res.status).toBe(200);
    const body = await readyBody(res);
    expect(body.status).toBe("ready");
    expect(body.checks.sealRequired).toBe(false);
    expect(body.checks.seal).toBe("disabled");
    expect(body.checks.sealReason).toContain("absent");
  });

  it("checks.seal reflète la réalité de la configuration (#155 — correctif A)", async () => {
    const cases = [
      { nodeEnv: "production", secret: undefined },
      { nodeEnv: "production", secret: VALID_SECRET },
      { nodeEnv: "development", secret: undefined },
      { nodeEnv: "development", secret: VALID_SECRET },
    ];
    const observed: string[] = [];
    for (const c of cases) {
      vi.stubEnv("NODE_ENV", c.nodeEnv);
      if (c.secret === undefined) delete process.env.CERT_SEAL_SECRET;
      else vi.stubEnv("CERT_SEAL_SECRET", c.secret);

      const res = await readyGET();
      const body = await readyBody(res);
      observed.push(`${c.nodeEnv}/${c.secret ? "key" : "no-key"}=${body.checks.seal}:${res.status}`);
    }

    expect(observed).toEqual([
      "production/no-key=missing:503",
      "production/key=ok:200",
      "development/no-key=disabled:200",
      "development/key=ok:200",
    ]);
  });

  it("environnement vitest non forcé (NODE_ENV != production) → 200 sans clé", async () => {
    expect(process.env.NODE_ENV).not.toBe("production");

    const res = await readyGET();

    expect(res.status).toBe(200);
    expect((await readyBody(res)).checks.sealRequired).toBe(false);
  });

  it("borne MIN_SECRET_LENGTH : 15 caractères → 503, 16 → 200", async () => {
    vi.stubEnv("NODE_ENV", "production");

    vi.stubEnv("CERT_SEAL_SECRET", "a".repeat(15));
    const tooShort = await readyGET();
    expect(tooShort.status).toBe(503);
    expect((await readyBody(tooShort)).checks.sealReason).toContain("trop court");

    vi.stubEnv("CERT_SEAL_SECRET", "b".repeat(16));
    const exact = await readyGET();
    expect(exact.status).toBe(200);
  });

  it("la réponse 503 n'expose jamais la valeur de la clé fournie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const weak = "abc123"; // volontairement < 16 caractères
    vi.stubEnv("CERT_SEAL_SECRET", weak);

    const res = await readyGET();
    const raw = JSON.stringify(await readyBody(res));

    expect(res.status).toBe(503);
    expect(raw).toContain("trop court");
    expect(raw).not.toContain(weak);
  });

  it("base indisponible en prod sans clé → 503 avec les DEUX causes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    db.queryRaw.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await readyGET();

    expect(res.status).toBe(503);
    const body = await readyBody(res);
    expect(body.checks.database).toBe("error");
    expect(body.checks.seal).toBe("missing");
  });

  it("interroge réellement la base via $queryRaw", async () => {
    await readyGET();
    expect(db.queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("/api/health — liveness non touché (#155)", () => {
  it("reste 200 en production même sans CERT_SEAL_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = healthGET();

    expect(res.status).toBe(200);
  });
});

describe("sonde indépendante — déterminisme de l'empreinte (#155)", () => {
  it("même charge utile + même clé → même sealHash", () => {
    const a = sealCertificate(payload, VALID_SECRET);
    const b = sealCertificate(payload, VALID_SECRET);

    expect(a).not.toBeNull();
    expect(a!.sealHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a!.sealHash).toBe(b!.sealHash);
  });

  it("un seul caractère modifié change l'empreinte", () => {
    const base = sealCertificate(payload, VALID_SECRET)!.sealHash;
    const altered = sealCertificate(
      { ...payload, fullName: "Alice Doé" },
      VALID_SECRET,
    )!.sealHash;

    expect(altered).not.toBe(base);
  });

  it("l'empreinte dépend de la clé (rotation détectée)", () => {
    const a = sealCertificate(payload, VALID_SECRET)!.sealHash;
    const b = sealCertificate(payload, "autre-secret-0123456789abcdef")!.sealHash;

    expect(a).not.toBe(b);
  });

  it("le log d'incident prod ne contient jamais la clé fournie", () => {
    vi.stubEnv("NODE_ENV", "production");
    const weak = "abc123";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const seal = sealCertificate(payload, getSealSecret(weak));

    expect(seal).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0][0]);
    expect(message).toContain("scellement désactivé");
    expect(message).not.toContain(weak);
  });

  it("FAUX POSITIF CONSTATÉ : un renommage légitime invalide tous les sceaux", () => {
    // Le sceau couvre formationName. Un renommage administratif de la formation
    // (ou une correction de faute dans fullName) fait donc basculer des
    // attestations intègres en "empreinte incohérente : données altérées".
    const seal = sealCertificate(payload, VALID_SECRET)!;

    const afterRename = verifyCertificateSeal(
      { ...payload, formationName: "Pisciculture (renommée)", sealHash: seal.sealHash },
      VALID_SECRET,
    );

    expect(afterRename.sealed).toBe(true);
    expect(afterRename.valid).toBe(false);
    expect(afterRename.reason).toBe("empreinte incohérente : données altérées");
  });

  it("un score inchangé reste valide (pas de faux positif sur arrondi)", () => {
    const seal = sealCertificate({ ...payload, certificationScore: 88 }, VALID_SECRET)!;
    const res = verifyCertificateSeal(
      { ...payload, certificationScore: 88.0, sealHash: seal.sealHash },
      VALID_SECRET,
    );
    expect(res.valid).toBe(true);
  });

  it("canonicalisation insensible à l'ordre des clés, null normalisés", () => {
    const a = canonicalizeSealPayload({
      code: "c",
      fullName: "n",
      endDate: "2026-09-01T10:00:00.000Z",
    });
    const b = canonicalizeSealPayload({
      fullName: "n",
      endDate: "2026-09-01T10:00:00.000Z",
      code: "c",
    });

    expect(a).toBe(b);
    expect(a).toContain('"certificationScore":null');
    expect(computeSealHash(a, VALID_SECRET)).toBe(computeSealHash(b, VALID_SECRET));
  });
});
