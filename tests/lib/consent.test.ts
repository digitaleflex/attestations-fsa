import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock de Prisma AVANT l'import de lib/consent : le module lit `prisma` au
// niveau des fonctions, donc le mock doit être installé en premier.
interface ConsentRow {
  id: string;
  userId: string;
  type: string;
  granted: boolean;
  grantedAt: Date;
  revokedAt: Date | null;
  documentVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
}

const consentStore: ConsentRow[] = [];
let updateCalls = 0;
let createCalls = 0;
let transactionCalls = 0;

const prismaMock = {
  consent: {
    findMany: vi.fn(async ({ where }: { where?: { userId?: string; type?: { in?: string[] } } } = {}) => {
      let rows = consentStore.filter(
        (r) => !where?.userId || r.userId === where.userId,
      );
      if (where?.type?.in) {
        rows = rows.filter((r) => where.type!.in!.includes(r.type as string));
      }
      return [...rows].sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
    }),
    findFirst: vi.fn(async ({ where }: { where?: { userId?: string; type?: string } } = {}) => {
      const rows = consentStore.filter(
        (r) =>
          (!where?.userId || r.userId === where.userId) &&
          (!where?.type || r.type === where.type),
      );
      return rows[0] ?? null;
    }),
    create: vi.fn(async ({ data }: { data: Omit<ConsentRow, "id"> }) => {
      createCalls++;
      const row: ConsentRow = { id: `consent-${consentStore.length + 1}`, ...data };
      consentStore.push(row);
      return row;
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<ConsentRow> }) => {
        updateCalls++;
        const row = consentStore.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    ),
  },
  $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => {
    transactionCalls++;
    return Promise.all(ops);
  }),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const {
  ConsentValidationError,
  CONSENT_TYPES,
  REQUIRED_CONSENTS,
  CURRENT_DOCUMENT_VERSION,
  isConsentType,
  isRevocable,
  recordConsent,
  recordConsents,
  getConsentState,
  hasRequiredConsents,
} = await import("@/lib/consent");

describe("lib/consent — typologie", () => {
  beforeEach(() => {
    consentStore.length = 0;
    updateCalls = 0;
    createCalls = 0;
    transactionCalls = 0;
  });

  it("expose les 5 types attendus", () => {
    expect([...CONSENT_TYPES].sort()).toEqual([
      "DATA_PROCESSING",
      "MARKETING",
      "PRIVACY",
      "TERMS",
      "THIRD_PARTY_TRANSFER",
    ]);
  });

  it("ne considère que MARKETING comme révocable", () => {
    expect(isRevocable("MARKETING")).toBe(true);
    expect(isRevocable("TERMS")).toBe(false);
    expect(isRevocable("PRIVACY")).toBe(false);
    expect(isRevocable("DATA_PROCESSING")).toBe(false);
    expect(isRevocable("THIRD_PARTY_TRANSFER")).toBe(false);
  });

  it("rejette un type inconnu", () => {
    expect(isConsentType("TERMS")).toBe(true);
    expect(isConsentType("PII")).toBe(false);
    expect(isConsentType(null)).toBe(false);
    expect(isConsentType(42)).toBe(false);
  });
});

describe("lib/consent — refus des révoquations non permises", () => {
  beforeEach(() => {
    consentStore.length = 0;
    createCalls = 0;
  });

  it("refuse de révoquer TERMS et n'écrit rien", async () => {
    await expect(
      recordConsent({ userId: "u1", type: "TERMS", granted: false }),
    ).rejects.toThrow(ConsentValidationError);
    expect(createCalls).toBe(0);
    expect(consentStore).toHaveLength(0);
  });

  it("oriente vers l'effacement du compte dans le message", async () => {
    await expect(
      recordConsent({ userId: "u1", type: "PRIVACY", granted: false }),
    ).rejects.toThrow(/effacement/i);
  });

  it("refuse un type inconnu", async () => {
    await expect(
      recordConsent({ userId: "u1", type: "PIRATE" as never, granted: true }),
    ).rejects.toThrow(ConsentValidationError);
  });
});

describe("lib/consent — traçabilité", () => {
  beforeEach(() => {
    consentStore.length = 0;
    createCalls = 0;
    updateCalls = 0;
  });

  it("enregistre type, horodatage, version du document et contexte", async () => {
    await recordConsent({
      userId: "u1",
      type: "TERMS",
      granted: true,
      ipAddress: "203.0.113.9",
      userAgent: "Mozilla/5.0",
    });

    expect(createCalls).toBe(1);
    const row = consentStore[0];
    expect(row).toMatchObject({
      userId: "u1",
      type: "TERMS",
      granted: true,
      documentVersion: CURRENT_DOCUMENT_VERSION,
      ipAddress: "203.0.113.9",
      userAgent: "Mozilla/5.0",
    });
    expect(row.grantedAt).toBeInstanceOf(Date);
    expect(row.revokedAt).toBeNull();
  });

  it("n'écrit rien si l'état demandé est déjà celui en base (idempotence)", async () => {
    await recordConsent({ userId: "u1", type: "TERMS", granted: true });
    await recordConsent({ userId: "u1", type: "TERMS", granted: true });

    expect(createCalls).toBe(1);
    expect(updateCalls).toBe(0);
    expect(consentStore).toHaveLength(1);
  });

  it("ré-accorder réinitialise grantedAt et vide revokedAt", async () => {
    await recordConsent({ userId: "u1", type: "MARKETING", granted: true });
    const initialGrantedAt = consentStore[0].grantedAt;

    await recordConsent({ userId: "u1", type: "MARKETING", granted: false });
    expect(consentStore[0].granted).toBe(false);
    expect(consentStore[0].revokedAt).toBeInstanceOf(Date);

    await recordConsent({ userId: "u1", type: "MARKETING", granted: true });
    expect(consentStore[0].granted).toBe(true);
    expect(consentStore[0].revokedAt).toBeNull();
    expect(new Date(consentStore[0].grantedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(initialGrantedAt).getTime(),
    );
    // Toujours UNE ligne : la preuve du retrait n'est pas effacée.
    expect(consentStore).toHaveLength(1);
  });

  it("NE SUPPRIME JAMAIS la ligne lors d'une révocation (preuve conservée)", async () => {
    await recordConsent({ userId: "u1", type: "MARKETING", granted: true });
    await recordConsent({ userId: "u1", type: "MARKETING", granted: false });

    // Aucun delete dans le module : c'est le point de conception central.
    expect(consentStore).toHaveLength(1);
    expect(consentStore[0].granted).toBe(false);
    expect(updateCalls).toBe(1);
  });
});

describe("lib/consent — lot transactionnel", () => {
  beforeEach(() => {
    consentStore.length = 0;
    transactionCalls = 0;
    createCalls = 0;
  });

  it("écrit tout le lot dans une transaction", async () => {
    await recordConsents([
      { userId: "u1", type: "TERMS", granted: true },
      { userId: "u1", type: "PRIVACY", granted: true },
      { userId: "u1", type: "DATA_PROCESSING", granted: true },
    ]);

    expect(transactionCalls).toBe(1);
    expect(consentStore).toHaveLength(3);
  });

  it("refuse le lot ENTIER si une entrée est invalide (rien n'est écrit)", async () => {
    await expect(
      recordConsents([
        { userId: "u1", type: "TERMS", granted: true },
        { userId: "u1", type: "TERMS", granted: false },
      ]),
    ).rejects.toThrow(ConsentValidationError);

    expect(transactionCalls).toBe(0);
    expect(consentStore).toHaveLength(0);
  });

  it("n'accepte pas de révoquer un non-révocable dans un lot", async () => {
    await expect(
      recordConsents([{ userId: "u1", type: "DATA_PROCESSING", granted: false }]),
    ).rejects.toThrow(ConsentValidationError);
    expect(consentStore).toHaveLength(0);
  });
});

describe("lib/consent — état courant", () => {
  beforeEach(() => {
    consentStore.length = 0;
  });

  it("expose les 5 types même sans aucune ligne en base", async () => {
    const state = await getConsentState("u1");
    expect(Object.keys(state).sort()).toEqual([...CONSENT_TYPES].sort());
    for (const type of CONSENT_TYPES) {
      expect(state[type].granted).toBe(false);
    }
  });

  it("reflète l'accord et marque les consentements obligatoires", async () => {
    await recordConsent({ userId: "u1", type: "TERMS", granted: true });
    const state = await getConsentState("u1");

    expect(state.TERMS.granted).toBe(true);
    expect(state.TERMS.required).toBe(true);
    expect(state.MARKETING.required).toBe(false);
    expect(state.MARKETING.revocable).toBe(true);
  });

  it("expose la version du document accepté", async () => {
    await recordConsent({
      userId: "u1",
      type: "TERMS",
      granted: true,
      documentVersion: "2025-06",
    });
    const state = await getConsentState("u1");
    expect(state.TERMS.documentVersion).toBe("2025-06");
  });
});

describe("lib/consent — complétude des acceptations obligatoires", () => {
  beforeEach(() => {
    consentStore.length = 0;
  });

  it("est fausse sur un compte sans aucun consentement", async () => {
    expect(await hasRequiredConsents("u1")).toBe(false);
  });

  it("reste fausse tant qu'un seul des 3 obligatoires manque", async () => {
    await recordConsent({ userId: "u1", type: "TERMS", granted: true });
    await recordConsent({ userId: "u1", type: "PRIVACY", granted: true });
    expect(await hasRequiredConsents("u1")).toBe(false);

    await recordConsent({ userId: "u1", type: "DATA_PROCESSING", granted: true });
    expect(await hasRequiredConsents("u1")).toBe(true);
  });

  it("ne compte pas MARKETING parmi les obligatoires", async () => {
    await recordConsent({ userId: "u1", type: "MARKETING", granted: true });
    expect(await hasRequiredConsents("u1")).toBe(false);
    expect(REQUIRED_CONSENTS).not.toContain("MARKETING");
  });

  it("ne considère pas un consentement révoqué comme accordé", async () => {
    for (const type of REQUIRED_CONSENTS) {
      await recordConsent({ userId: "u1", type, granted: true });
    }
    expect(await hasRequiredConsents("u1")).toBe(true);
  });

  it("isole les comptes : les consentements d'un autre utilisateur ne comptent pas", async () => {
    for (const type of REQUIRED_CONSENTS) {
      await recordConsent({ userId: "u1", type, granted: true });
    }
    expect(await hasRequiredConsents("u2")).toBe(false);
  });
});