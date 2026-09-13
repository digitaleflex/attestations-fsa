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

function callGet() {
  return GET();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/public/settings (#138)", () => {
  it("retourne les settings publics (sélection restreinte)", async () => {
    db.settingsFindFirst.mockResolvedValue({
      institutionName: "FSA",
      institutionLogo: "logo.png",
      instructorName: "Dir",
      instructorTitle: "Resp",
      signatureUrl: "sig.png",
      location: "Cotonou",
      supportEmail: "contact@fsa.bj",
    } as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.institutionName).toBe("FSA");
    expect(body.supportEmail).toBe("contact@fsa.bj");
    // La sélection ne doit exposer QUE les champs publics
    expect(db.settingsFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          institutionName: true,
          supportEmail: true,
        }),
      }),
    );
  });

  it("retourne des valeurs par défaut si aucun settings", async () => {
    db.settingsFindFirst.mockResolvedValue(null as never);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.institutionName).toContain("Ferme Agro-Piscicole");
    expect(body.supportEmail).toBe("contact@fsa.bj");
  });

  it("500 si erreur DB", async () => {
    db.settingsFindFirst.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(500);
  });
});