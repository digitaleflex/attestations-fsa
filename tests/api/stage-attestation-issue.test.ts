// #265 — Refus des demandes non ACCEPTED et garantie d'idempotence
// (une seule attestation STAGE par InternshipRequest, y compris en concurrence).
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import type { StageAttestationOutcome } from "@/lib/stage-attestation/issue";

// ---------------------------------------------------------------------------
// Faux Prisma en mémoire, avec sémantique transactionnelle réelle
// (snapshot / rollback, sérialisation, conflits d'écriture P2034).
// ---------------------------------------------------------------------------

type Mode = "serial" | "p2034";

interface FakeState {
  internship: Record<string, any> | null;
  settings: Record<string, any> | null;
  formation: Record<string, any> | null;
  attestations: Record<string, any>[];
  createCalls: number;
  archiveCalls: number;
}

const holder = vi.hoisted(() => ({ prisma: null as any }));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, prop) {
        const value = (holder.prisma as any)[prop as string];
        if (typeof value !== "function") {
          throw new Error(`prisma.${String(prop)} non simulé`);
        }
        return value;
      },
    },
  ),
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "../../app/api/admin/internships/[id]/attestation/route";
import { clearStageAttestationInFlightForTests, issueStageAttestation } from "@/lib/stage-attestation";

function acceptedInternship(overrides: Record<string, any> = {}) {
  return {
    id: "intern-1",
    userId: "user-1",
    fullName: "Alice DOSSOU",
    position: "Pisciculture",
    status: "ACCEPTED",
    createdAt: new Date("2025-12-01T00:00:00.000Z"),
    user: {
      id: "user-1",
      birthDate: new Date("2000-01-01T00:00:00.000Z"),
      birthPlace: "Cotonou",
    },
    ...overrides,
  };
}

function freshState(overrides: Record<string, any> = {}): FakeState {
  return {
    internship: acceptedInternship(overrides),
    settings: {
      institutionName: "FSA",
      location: "Abomey-Calavi",
      instructorName: "Directeur Technique",
    },
    formation: { id: "formation-1", name: "Stage", category: "STAGE" },
    attestations: [],
    createCalls: 0,
    archiveCalls: 0,
  };
}

function installFakePrisma(state: FakeState, mode: Mode = "serial") {
  let mutex: Promise<unknown> = Promise.resolve();
  let active = 0;

  const client = {
    $queryRaw: async () => [{ nextval: BigInt(state.attestations.length + 1) }],
    internshipRequest: {
      findUnique: async () => (state.internship ? structuredClone(state.internship) : null),
      updateMany: async ({ where, data }: any) => {
        if (!state.internship) return { count: 0 };
        if (where.status && state.internship.status !== where.status) return { count: 0 };
        Object.assign(state.internship, data);
        state.archiveCalls += 1;
        return { count: 1 };
      },
      update: async ({ data }: any) => {
        Object.assign(state.internship!, data);
        state.archiveCalls += 1;
        return { id: state.internship!.id };
      },
    },
    formation: {
      findFirst: async ({ where }: any) => {
        if (!state.formation) return null;
        if (where.category && state.formation.category !== where.category) return null;
        return structuredClone(state.formation);
      },
      create: async ({ data }: any) => {
        state.formation = { id: "formation-new", category: "STAGE", ...data };
        return structuredClone(state.formation);
      },
    },
    settings: {
      findFirst: async () => (state.settings ? structuredClone(state.settings) : null),
    },
    attestation: {
      findFirst: async ({ where }: any) => {
        const found = state.attestations.find((a) => {
          if (where.type && a.type !== where.type) return false;
          if (where.userId !== undefined && a.userId !== where.userId) return false;
          if (where.fullName !== undefined && a.fullName !== where.fullName) return false;
          if (where.startDate && a.startDate.getTime() !== where.startDate.getTime()) return false;
          if (where.endDate && a.endDate.getTime() !== where.endDate.getTime()) return false;
          if (where.issuedAt?.gte && a.issuedAt.getTime() < where.issuedAt.gte.getTime()) return false;
          return true;
        });
        return found ? { id: found.id, code: found.code } : null;
      },
      count: async () => state.attestations.length,
      create: async ({ data }: any) => {
        const record = {
          id: `att-${state.attestations.length + 1}`,
          issuedAt: new Date(),
          ...data,
        };
        state.attestations.push(record);
        state.createCalls += 1;
        return { id: record.id, code: record.code };
      },
    },
  };

  const runTransaction = async (fn: (tx: any) => Promise<unknown>) => {
    if (mode === "p2034") {
      // Sérialisabilité PostgreSQL : le second écrivain en cours tombe en
      // P2034 (write conflict / serialization failure).
      if (active > 0) {
        throw new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict or a deadlock", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      active += 1;
      try {
        return await fn(client);
      } finally {
        active -= 1;
      }
    }
    // Mode sérial : une transaction à la fois + rollback sur exception.
    const run = mutex.then(async () => {
      const snapshot = structuredClone({
        internship: state.internship,
        attestations: state.attestations,
        createCalls: state.createCalls,
        archiveCalls: state.archiveCalls,
      });
      try {
        return await fn(client);
      } catch (error) {
        state.internship = snapshot.internship;
        state.attestations = snapshot.attestations;
        state.createCalls = snapshot.createCalls;
        state.archiveCalls = snapshot.archiveCalls;
        throw error;
      }
    });
    mutex = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  holder.prisma = {
    ...client,
    $transaction: runTransaction,
  };
}

let state: FakeState;

function callPost(body: unknown, id = "intern-1") {
  const request = new NextRequest(
    `http://localhost/api/admin/internships/${id}/attestation`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  return POST(request, { params: Promise.resolve({ id }) });
}

const validBody = { startDate: "2026-01-01", endDate: "2026-06-01", stageScore: 15 };

const SEAL_SECRET = "stage-attestation-test-secret-0123456789abcdef";

beforeEach(() => {
  vi.clearAllMocks();
  // #288 — le scellement est désormais obligatoire sur cette voie : sans clé,
  // l'émission est refusée en 503 et rien n'est écrit. Ces tests couvrent
  // l'idempotence et les valeurs persistées, pas l'absence de clé : on
  // configure donc une clé valide pour tout le fichier.
  process.env.CERT_SEAL_SECRET = SEAL_SECRET;
  clearStageAttestationInFlightForTests();
  state = freshState();
  installFakePrisma(state);
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
});

afterEach(() => {
  delete process.env.CERT_SEAL_SECRET;
});

// ---------------------------------------------------------------------------

describe("#265 statut de la demande de stage", () => {
  it("401 si non admin", async () => {
    deps.getAdminUser.mockResolvedValue(null as never);
    const res = await callPost(validBody);
    expect(res.status).toBe(401);
    expect(state.attestations).toHaveLength(0);
  });

  it("404 si demande introuvable", async () => {
    state.internship = null;
    const res = await callPost(validBody);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ code: "INTERNSHIP_NOT_FOUND" });
  });

  it.each(["PENDING", "REVIEWING", "REJECTED", "ARCHIVED"])(
    "refuse (409) une demande %s",
    async (status) => {
      state.internship = acceptedInternship({ status });
      const res = await callPost(validBody);

      expect(res.status).toBe(409);
      const payload = await res.json();
      expect(["INTERNSHIP_NOT_ACCEPTED", "ATTESTATION_ALREADY_ISSUED"]).toContain(payload.code);
      expect(state.attestations).toHaveLength(0);
      expect(deps.createAuditLog).not.toHaveBeenCalled();
    },
  );

  it("n'archive pas une demande refusée", async () => {
    state.internship = acceptedInternship({ status: "PENDING" });
    await callPost(validBody);
    expect(state.archiveCalls).toBe(0);
    expect(state.internship?.status).toBe("PENDING");
  });
});

describe("#265 idempotence par demande de stage", () => {
  it("un second appel séquentiel est refusé (409) et ne crée rien", async () => {
    const first = await callPost(validBody);
    expect(first.status).toBe(200);
    expect(state.attestations).toHaveLength(1);

    const second = await callPost(validBody);
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ code: "ATTESTATION_ALREADY_ISSUED" });

    expect(state.attestations).toHaveLength(1);
    expect(state.createCalls).toBe(1);
    expect(deps.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it("refuse un doublon même si la demande est remise ACCEPTED (garde-fou secondaire)", async () => {
    await callPost(validBody);
    state.internship!.status = "ACCEPTED"; // ré-ouverture manuelle
    const res = await callPost(validBody);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "DUPLICATE_STAGE_ATTESTATION" });
    expect(state.attestations).toHaveLength(1);
  });

  it("deux appels concurrents : une seule attestation", async () => {
    const [a, b] = await Promise.all([callPost(validBody), callPost(validBody)]);
    const statuses = [a.status, b.status].sort();

    expect(statuses).toEqual([200, 409]);
    expect(state.attestations).toHaveLength(1);
    expect(state.createCalls).toBe(1);
    expect(deps.createAuditLog).toHaveBeenCalledTimes(1);
  });

  it("plusieurs appels concurrents en rafale : une seule attestation", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => callPost(validBody)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(state.attestations).toHaveLength(1);
  });

  it("conflit de sérialisation (P2034) => 409 CONCURRENT_REQUEST, aucun doublon", async () => {
    installFakePrisma(state, "p2034");
    // Clés de lock distinctes : on force le passage par la base, pas par le
    // verrou applicatif en processus.
    const run = (lockKey: string): Promise<StageAttestationOutcome> =>
      issueStageAttestation({ internshipRequestId: "intern-1", body: validBody, lockKey });

    const [first, second] = await Promise.allSettled([run("a"), run("b")]);
    const fulfilled = [first, second].filter((r) => r.status === "fulfilled");
    const rejected = [first, second].filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const error = (rejected[0] as PromiseRejectedResult).reason as { status: number; code: string };
    expect(error.code).toBe("CONCURRENT_REQUEST");
    expect(error.status).toBe(409);
  });

  it("le verrou en processus sérialise les appels sur la même demande", async () => {
    const order: string[] = [];
    const track = (label: string) => (result: StageAttestationOutcome) => {
      order.push(label);
      return result;
    };
    const first = issueStageAttestation({ internshipRequestId: "intern-1", body: validBody }).then(track("first"));
    const second = issueStageAttestation({ internshipRequestId: "intern-1", body: validBody }).then(
      track("second"),
      track("second"),
    );
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
    expect(state.attestations).toHaveLength(1);
  });
});

describe("#265/#266 erreurs remontées au client", () => {
  it("409 si l'identité du dossier est incomplète (aucune valeur inventée)", async () => {
    state.internship = acceptedInternship({ user: { id: "user-1", birthDate: null, birthPlace: null } });
    const res = await callPost(validBody);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: "INCOMPLETE_IDENTITY" });
    expect(state.attestations).toHaveLength(0);
  });

  it("500 masqué si Prisma échoue (aucun message Prisma au client)", async () => {
    holder.prisma.$transaction = async () => {
      throw new Prisma.PrismaClientUnknownRequestError(
        "Can't reach database server at `db.internal:5432` (ECONNREFUSED)",
        { clientVersion: "test" },
      );
    };
    const res = await callPost(validBody);

    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("db.internal");
    expect(text).toContain("INTERNAL_ERROR");
  });

  it("P2002 (unicité code) est requalifié en 409 sans fuite de détail", async () => {
    holder.prisma.$transaction = async () => {
      throw new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`code`)",
        { code: "P2002", clientVersion: "test" },
      );
    };
    const res = await callPost(validBody);

    expect(res.status).toBe(409);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("Unique constraint");
    expect(text).not.toContain("P2002");
    expect(text).toContain("CONCURRENT_REQUEST");
  });

  it("400 avec le détail des champs pour un corps invalide", async () => {
    const res = await callPost({ startDate: "01/01/2026", endDate: "2026-06-01", stageScore: 500 });
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(state.attestations).toHaveLength(0);
  });

  it("n'émet jamais de données d'identité fournies par le client", async () => {
    const res = await callPost({ ...validBody, birthDate: "1995-01-01", birthPlace: "Paris" });
    expect(res.status).toBe(400);
    expect(state.attestations).toHaveLength(0);
  });
});

describe("#266 valeurs persistées", () => {
  it("reprend l'identité du dossier utilisateur sans valeur de repli", async () => {
    const res = await callPost(validBody);
    expect(res.status).toBe(200);
    const [attestation] = state.attestations;
    expect(attestation.birthDate).toEqual(new Date("2000-01-01T00:00:00.000Z"));
    expect(attestation.birthPlace).toBe("Cotonou");
  });

  it("n'invente ni note ni observations absentes", async () => {
    const res = await callPost({ startDate: "2026-01-01", endDate: "2026-06-01" });
    expect(res.status).toBe(200);
    const [attestation] = state.attestations;
    expect(attestation.stageScore).toBeNull();
    expect(attestation.stageObservations).toBeNull();
    expect(attestation.location).toBe("Abomey-Calavi");
    expect(attestation.instructor).toBe("Directeur Technique");
    expect(attestation.issuingCompany).toBe("FSA");
  });

  it("conserve un score et des observations valides", async () => {
    const res = await callPost({
      ...validBody,
      stageScore: "87.5",
      stageObservations: "Bon travail",
      location: "Cotonou",
      instructor: "M. X",
    });
    expect(res.status).toBe(200);
    const [attestation] = state.attestations;
    expect(attestation.stageScore).toBe(87.5);
    expect(attestation.stageObservations).toBe("Bon travail");
    expect(attestation.location).toBe("Cotonou");
  });
});
