/**
 * #291 — Export RGPD : `GET /api/user/export`.
 *
 * Contrat vérifié ici :
 *  - l'export est rendu au SEUL utilisateur connecté, via le mécanisme de
 *    cloisonnement du dépôt (`getCurrentUser`) ;
 *  - un utilisateur ne peut PAS exporter les données d'un autre : l'identifiant
 *    de périmètre vient exclusivement de la session, jamais de la requête
 *    (paramètre d'URL, en-tête) ;
 *  - l'export ne contient AUCUN secret : ni hash de mot de passe, ni secret ou
 *    code de double authentification, ni jeton, ni clé de stockage, ni valeur
 *    probante de scellement ;
 *  - il contient bien les données personnelles : profil, attestations,
 *    sessions d'examen et réponses, inscriptions, demandes de stage,
 *    corrections, réclamations, notifications, journal d'audit, objets stockés.
 *
 * ── PIÈGE DU TEST ──────────────────────────────────────────────────────────
 * Les mocks simulent une base qui contient TOUS les secrets (`password`,
 * `TwoFactor.secret`, `Session.token`, `sealHash`, `pdfKey`, `pdfUrl`,
 * `pdfHash`, `StoredObject.key`, `cvKey`…). Ils appliquent ensuite le `select`
 * réellement reçu de la route. Un secret n'apparaît donc dans la réponse que si
 * la route l'a explicitement demandé : un `select` trop large fait échouer le
 * test, il ne peut pas le contourner.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

type Row = Record<string, unknown>;

/** Applique le `select` réel de la route à une ligne complète (tout compris). */
function project(row: Row, select: Record<string, boolean> | undefined): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [field, wanted] of Object.entries(select)) {
    if (wanted) out[field] = row[field];
  }
  return out;
}

/** FindMany qui projette chaque ligne selon le `select` demandé. */
function projectedFindMany(
  rows: Row[],
  where: Record<string, unknown> | undefined,
  select: Record<string, boolean> | undefined,
): Row[] {
  return rows
    .filter((row) =>
      Object.entries(where ?? {}).every(([field, value]) => row[field] === value),
    )
    .map((row) => project(row, select));
}

const db = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  attestationFindMany: vi.fn(),
  examSessionFindMany: vi.fn(),
  examEnrollmentFindMany: vi.fn(),
  internshipRequestFindMany: vi.fn(),
  correctionRequestFindMany: vi.fn(),
  reclamationFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  auditLogFindMany: vi.fn(),
  storedObjectFindMany: vi.fn(),
  twoFactorFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: db.userFindUnique },
    attestation: { findMany: db.attestationFindMany },
    examSession: { findMany: db.examSessionFindMany },
    examEnrollment: { findMany: db.examEnrollmentFindMany },
    internshipRequest: { findMany: db.internshipRequestFindMany },
    correctionRequest: { findMany: db.correctionRequestFindMany },
    reclamation: { findMany: db.reclamationFindMany },
    notification: { findMany: db.notificationFindMany },
    auditLog: { findMany: db.auditLogFindMany },
    storedObject: { findMany: db.storedObjectFindMany },
    // Délégués PIÈGE : la route ne doit JAMAIS les lire.
    twoFactor: { findMany: db.twoFactorFindMany },
    session: { findMany: vi.fn() },
    account: { findMany: vi.fn() },
  },
}));

const deps = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: deps.getCurrentUser }));

import { GET } from "../../app/api/user/export/route";
import { makeRequest } from "../helpers/request";

/** Lignes "base" : la réalité complète, secrets compris. */
const FULL_USER = {
  id: "user-1",
  name: "Awa Diallo",
  email: "awa.diallo@exemple.test",
  emailVerified: new Date("2026-01-05T00:00:00.000Z"),
  image: null,
  password: "$scrypt$n=16384,r=8$deadbeef$deadbeefdeadbeef",
  role: "user",
  status: "ACTIVE",
  banned: false,
  banReason: null,
  banExpires: null,
  resetPasswordRequired: false,
  birthDate: new Date("1990-02-01T00:00:00.000Z"),
  birthPlace: "Abomey-Calavi",
  phone: "+229 90 00 00 00",
  address: "Cotonou",
  gender: "F",
  examId: "exam-1",
  examScheduledAt: null,
  formationId: "formation-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

const FULL_ATTESTATION = {
  id: "att-1",
  userId: "user-1",
  code: "FSA-2026-M09-00001-abcde",
  type: "CERTIFICATION",
  status: "VALIDATED",
  fullName: "Awa Diallo",
  email: "awa.diallo@exemple.test",
  birthDate: new Date("1990-02-01T00:00:00.000Z"),
  birthPlace: "Abomey-Calavi",
  gender: "F",
  formationId: "formation-1",
  sessionId: "session-1",
  issuedAt: new Date("2026-09-01T00:00:00.000Z"),
  startDate: new Date("2026-08-05T00:00:00.000Z"),
  endDate: new Date("2026-08-20T00:00:00.000Z"),
  location: "Abomey-Calavi",
  instructor: "Direction Technique FSA",
  issuingCompany: "FSA",
  certificationHours: 40,
  certificationMention: "BIEN",
  certificationObservations: "Bon niveau",
  certificationScore: 72,
  stageHours: null,
  stageObservations: null,
  stageScore: null,
  deletedAt: null,
  deletedById: null,
  deleteReason: null,
  revokedAt: null,
  revokedById: null,
  revokeReason: null,
  retrogradedAt: null,
  retrogradedById: null,
  retrogradeReason: null,
  // ── Secrets et preuves internes : NE DOIVENT JAMAIS sortir. ──
  pdfUrl: "/documents/att-1.pdf",
  pdfKey: "attestations/att-1.pdf",
  pdfHash: "d".repeat(64),
  sealHash: "c".repeat(64),
  // ── Métadonnées non sensibles : doivent sortir. ──
  pdfVersion: 2,
  pdfGeneratedAt: new Date("2026-09-01T00:10:00.000Z"),
  sealedAt: new Date("2026-09-01T00:10:01.000Z"),
  sealVersion: 2,
};

const FULL_EXAM_SESSION = {
  id: "session-1",
  userId: "user-1",
  examId: "exam-1",
  status: "GRADED",
  type: "OFFICIAL",
  scorePart1: 18,
  scorePart2: 32,
  scorePart3: 40,
  totalScore: 90,
  internshipScore: 0,
  finalScore: 90,
  startedAt: new Date("2026-09-01T08:00:00.000Z"),
  submittedAt: new Date("2026-09-01T10:00:00.000Z"),
  gradedAt: new Date("2026-09-01T12:00:00.000Z"),
  gradedBy: "admin-1",
  observations: "Bonne copie",
  answers: { "1": "A", "2": "B" },
  archivedAt: null,
  archivedById: null,
  archiveReason: null,
};

const FULL_STORED_OBJECT = {
  id: "obj-1",
  key: "attestations/att-1.pdf",
  ownerUserId: "user-1",
  purpose: "ATTESTATION_PDF",
  linkedEntityType: "ATTESTATION",
  linkedEntityId: "att-1",
  checksum: "d".repeat(64),
  sizeBytes: 51200,
  contentType: "application/pdf",
  retentionUntil: null,
  createdAt: new Date("2026-09-01T00:10:00.000Z"),
  updatedAt: new Date("2026-09-01T00:10:00.000Z"),
};

const FULL_INTERNSHIP = {
  id: "int-1",
  fullName: "Awa Diallo",
  email: "awa.diallo@exemple.test",
  phone: "+229 90 00 00 00",
  university: "FSA",
  level: "L3",
  position: "Technicienne",
  message: "Cv ci-joint",
  status: "PENDING",
  createdAt: new Date("2026-09-02T00:00:00.000Z"),
  updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  userId: "user-1",
  cvUrl: "https://exemple.test/cv/1.pdf",
  cvKey: "cvs/1.pdf",
};

/** Parcourt toute la charge utile exportée, clés comprises. */
function collectKeys(value: unknown, path = "$", acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectKeys(item, `${path}[${index}]`, acc));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      acc.push(`${path}.${key}`);
      collectKeys(child, `${path}.${key}`, acc);
    }
  }
  return acc;
}

const scopedDelegates = () => [
  db.attestationFindMany,
  db.examSessionFindMany,
  db.examEnrollmentFindMany,
  db.internshipRequestFindMany,
  db.correctionRequestFindMany,
  db.reclamationFindMany,
  db.notificationFindMany,
  db.auditLogFindMany,
  db.storedObjectFindMany,
];

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1", email: "awa@x.test" } as never);

  db.userFindUnique.mockImplementation(
    async (args: { where: { id: string }; select?: Record<string, boolean> }) =>
      (args.where.id === FULL_USER.id ? project(FULL_USER, args.select) : null) as never,
  );
  db.attestationFindMany.mockImplementation(
    async (args: { where: Row; select?: Record<string, boolean> }) =>
      projectedFindMany([FULL_ATTESTATION], args.where, args.select) as never,
  );
  db.examSessionFindMany.mockImplementation(
    async (args: { where: Row; select?: Record<string, boolean> }) =>
      projectedFindMany([FULL_EXAM_SESSION], args.where, args.select) as never,
  );
  db.storedObjectFindMany.mockImplementation(
    async (args: { where: Row; select?: Record<string, boolean> }) =>
      projectedFindMany([FULL_STORED_OBJECT], args.where, args.select) as never,
  );
  db.internshipRequestFindMany.mockImplementation(
    async (args: { where: Row; select?: Record<string, boolean> }) =>
      projectedFindMany([FULL_INTERNSHIP], args.where, args.select) as never,
  );
  for (const delegate of [
    db.examEnrollmentFindMany,
    db.correctionRequestFindMany,
    db.reclamationFindMany,
    db.notificationFindMany,
    db.auditLogFindMany,
    db.twoFactorFindMany,
  ]) {
    delegate.mockResolvedValue([] as never);
  }
});

describe("GET /api/user/export — export RGPD (#291)", () => {
  it("401 sans session authentifiée, et aucune lecture en base", async () => {
    deps.getCurrentUser.mockResolvedValue(null as never);
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(401);
    expect(db.userFindUnique).not.toHaveBeenCalled();
    for (const delegate of [...scopedDelegates(), db.twoFactorFindMany]) {
      expect(delegate).not.toHaveBeenCalled();
    }
  });

  it("404 si le profil du titulaire est introuvable", async () => {
    db.userFindUnique.mockResolvedValue(null as never);
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(404);
  });

  it("l'export contient bien les données personnelles du titulaire", async () => {
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.formatVersion).toBe(1);
    expect(payload.profile).toMatchObject({
      id: "user-1",
      name: "Awa Diallo",
      email: "awa.diallo@exemple.test",
      phone: "+229 90 00 00 00",
      address: "Cotonou",
      birthPlace: "Abomey-Calavi",
    });
    expect(payload.attestations).toHaveLength(1);
    expect(payload.attestations[0]).toMatchObject({
      code: "FSA-2026-M09-00001-abcde",
      certificationScore: 72,
      certificationMention: "BIEN",
      hasDocument: true,
      isSealed: true,
    });
    // Les sessions d'examen ET leurs réponses sont des données personnelles.
    expect(payload.examSessions).toHaveLength(1);
    expect(payload.examSessions[0].answers).toEqual({ "1": "A", "2": "B" });
    // Les liens vers les documents de l'intéressé sortent, sans leur clé.
    expect(payload.storedObjects).toHaveLength(1);
    expect(payload.storedObjects[0]).toMatchObject({ purpose: "ATTESTATION_PDF" });
    // Les demandes de stage du compte sortent, sans les clés de CV.
    expect(payload.internshipRequests).toHaveLength(1);
    for (const section of [
      "examEnrollments",
      "correctionRequests",
      "reclamations",
      "notifications",
      "auditTrail",
    ]) {
      expect(payload).toHaveProperty(section);
    }
  });

  it("l'export ne contient aucun secret : ni mot de passe, ni 2FA, ni jeton, ni clé, ni sceau", async () => {
    const res = await GET(makeRequest(undefined));
    const payload = await res.json();
    const keys = collectKeys(payload);

    const forbidden = [
      "password",
      "hashedPassword",
      "secret",
      "backupCodes",
      "token",
      "accessToken",
      "refreshToken",
      "idToken",
      "sessionToken",
      "sealHash",
      "pdfKey",
      "pdfUrl",
      "pdfHash",
      "key",
      "cvKey",
      "cvUrl",
    ];
    for (const key of keys) {
      const leaf = key.slice(key.lastIndexOf(".") + 1);
      expect(forbidden).not.toContain(leaf);
    }
  });

  it("aucune valeur de preuve ou de secret ne fuit dans le corps sérialisé", async () => {
    const res = await GET(makeRequest(undefined));
    const serialized = JSON.stringify(await res.json());
    // Valeurs présentes en base et ABSENTES de la réponse.
    expect(serialized).not.toContain("c".repeat(64)); // sealHash
    expect(serialized).not.toContain("attestations/"); // pdfKey
    expect(serialized).not.toContain("cvs/"); // cvKey
    expect(serialized).not.toContain("$scrypt"); // hash de mot de passe
    expect(serialized).not.toContain("deadbeef");
  });

  it("les preuves sont seulement signalées, jamais divulguées", async () => {
    const res = await GET(makeRequest(undefined));
    const [attestation] = (await res.json()).attestations;
    // Métadonnées non sensibles conservées…
    expect(attestation).toHaveProperty("sealedAt");
    expect(attestation).toHaveProperty("sealVersion");
    expect(attestation).toHaveProperty("pdfVersion");
    expect(attestation).toHaveProperty("pdfGeneratedAt");
    expect(attestation).toHaveProperty("hasDocument", true);
    expect(attestation).toHaveProperty("isSealed", true);
    // …valeur probante et clés de stockage absentes.
    expect(attestation).not.toHaveProperty("sealHash");
    expect(attestation).not.toHaveProperty("pdfKey");
    expect(attestation).not.toHaveProperty("pdfHash");
    expect(attestation).not.toHaveProperty("pdfUrl");
  });

  it("la route ne lit jamais les tables de credentials ni de sessions", async () => {
    await GET(makeRequest(undefined));
    expect(db.twoFactorFindMany).not.toHaveBeenCalled();
  });

  it("un utilisateur ne peut pas exporter les données d'un autre : le périmètre vient de la session", async () => {
    // Tentative de dérive de périmètre : en-tête + paramètres d'URL.
    const request = makeRequest(undefined, {
      "x-user-id": "user-2",
      "x-forwarded-user": "user-2",
    });
    (request as unknown as { url: string }).url =
      "https://exemple.test/api/user/export?userId=user-2&id=user-3&user=user-4";

    const res = await GET(request);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.profile.id).toBe("user-1");
    expect(payload.attestations).toHaveLength(1);

    // Toutes les lectures sont bornées au compte de la session.
    for (const delegate of scopedDelegates()) {
      const args = delegate.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(Object.values(args.where)).toContain("user-1");
      const serializedArgs = JSON.stringify(args);
      for (const foreign of ["user-2", "user-3", "user-4"]) {
        expect(serializedArgs).not.toContain(foreign);
      }
    }
    const profileArgs = db.userFindUnique.mock.calls[0][0] as { where: { id: string } };
    expect(profileArgs.where.id).toBe("user-1");
  });

  it("l'export n'est pas mis en cache", async () => {
    const res = await GET(makeRequest(undefined));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("500 si une lecture échoue", async () => {
    db.attestationFindMany.mockRejectedValue(new Error("db down") as never);
    const res = await GET(makeRequest(undefined));
    expect(res.status).toBe(500);
  });
});
