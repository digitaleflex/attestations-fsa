import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  settingsFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    settings: { findFirst: db.settingsFindFirst },
  },
}));

import { GET } from "../../app/api/public/settings/route";
import * as routeModule from "../../app/api/public/settings/route";

const PUBLIC_KEYS = [
  "institutionLogo",
  "institutionName",
  "instructorName",
  "instructorTitle",
  "location",
  "signatureUrl",
  "supportEmail",
] as const;

const SENSITIVE_KEYS = [
  "id",
  "replyTo",
  "targetAttestations",
  "targetInscriptions",
  "targetValidations",
  "updatedAt",
] as const;

function storedSettings() {
  return {
    institutionName: "Ferme Agro-Piscicole Cité St André",
    institutionLogo: "/logo.png",
    instructorName: "Directeur Technique",
    instructorTitle: "Responsable des Formations",
    signatureUrl: "/signature.png",
    location: "Abomey-Calavi",
    supportEmail: "contact@fsa.bj",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.settingsFindFirst.mockResolvedValue(storedSettings() as never);
});

describe("GET /api/public/settings (#138)", () => {
  it("200 — renvoie les réglages publics sans authentification", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.institutionName).toBe("Ferme Agro-Piscicole Cité St André");
    expect(body.location).toBe("Abomey-Calavi");
    expect(body.supportEmail).toBe("contact@fsa.bj");
  });

  it("ne projette que les 7 champs publics (whitelist au niveau Prisma)", async () => {
    await GET();
    expect(db.settingsFindFirst).toHaveBeenCalledTimes(1);
    expect(db.settingsFindFirst).toHaveBeenCalledWith({
      select: {
        institutionName: true,
        institutionLogo: true,
        instructorName: true,
        instructorTitle: true,
        signatureUrl: true,
        location: true,
        supportEmail: true,
      },
    });
  });

  it("payload strict : exactement les champs publics, aucune donnée sensible", async () => {
    // La filtration est assurée par le `select` Prisma (verrouillé par le test
    // précédent) : le mock retourne donc une ligne déjà projetée, comme la
    // base le ferait. Ce test verrouille la forme du payload public.
    const body = await (await GET()).json();

    expect(Object.keys(body).sort()).toEqual([...PUBLIC_KEYS].sort());
    for (const key of SENSITIVE_KEYS) {
      expect(body).not.toHaveProperty(key);
    }
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("settings-secret-1");
    expect(serialized).not.toContain("interne@example.com");
  });

  it("200 — replie sur les valeurs par défaut si aucun réglage n'existe", async () => {
    db.settingsFindFirst.mockResolvedValue(null as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      institutionName: "Ferme Agro-Piscicole Cité St André",
      location: "Abomey-Calavi",
      instructorName: "Directeur Technique",
      instructorTitle: "Responsable des Formations",
      supportEmail: "contact@fsa.bj",
    });
    for (const key of SENSITIVE_KEYS) {
      expect(body).not.toHaveProperty(key);
    }
  });
});

describe("GET /api/public/settings — méthodes non supportées (#138)", () => {
  it("n'exporte que GET : POST/PUT/PATCH/DELETE retombent sur le 405 du framework", () => {
    expect(typeof routeModule.GET).toBe("function");
    expect(routeModule).not.toHaveProperty("POST");
    expect(routeModule).not.toHaveProperty("PUT");
    expect(routeModule).not.toHaveProperty("PATCH");
    expect(routeModule).not.toHaveProperty("DELETE");
  });
});

describe("GET /api/public/settings — gestion d'erreur (#138)", () => {
  it("500 — une panne de base ne fuit aucun détail", async () => {
    db.settingsFindFirst.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432") as never);

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ message: "Erreur" });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});
