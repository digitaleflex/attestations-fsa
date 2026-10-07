/**
 * #321 — « Pas de fuite d'erreur au client ».
 *
 * Non-régression sur le mécanisme centralisé `handleApiError`
 * (`lib/error-handler.ts`), appliqué ici à une route d'action réelle :
 * `POST /api/admin/attestations/[id]/actions`.
 *
 * Ce que le test verrouille, dans les deux sens :
 *
 *  1. Les erreurs TECHNIQUES (ici une violation de contrainte Prisma) ne
 *     doivent PAS atteindre le client en production — ni le message, ni le nom
 *     de table/modèle, ni le nom de colonne, ni la valeur en cause. Elles
 *     doivent être journalisées côté serveur.
 *  2. Les erreurs MÉTIER doivent continuer de PARLER au client. Un masque
 *     aveugle casserait le formulaire d'administration : « motif obligatoire »,
 *     « attestation supprimée logiquement », 404, 401… doivent rester lisibles,
 *     en production comme en développement.
 *  3. Le diagnostic développeur ne doit PAS être dégradé : en développement,
 *     le message et la stack restent visibles.
 *
 * C'est la distinction technique / métier qui est le cœur du sujet : un
 * message de validation utile au client ne doit pas être confondu avec une
 * fuite d'infrastructure.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ------------------------------------------------------------------ mocks */

const db = vi.hoisted(() => ({
  attestationFindUnique: vi.fn(),
  attestationUpdate: vi.fn(),
  examSessionUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: {
      findUnique: db.attestationFindUnique,
      update: db.attestationUpdate,
    },
    examSession: { updateMany: db.examSessionUpdateMany },
  },
}));

const deps = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  createNotification: vi.fn(),
  notifyAllAdmins: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAdminUser: deps.getAdminUser }));
vi.mock("@/lib/notifications", () => ({
  createNotification: deps.createNotification,
  notifyAllAdmins: deps.notifyAllAdmins,
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: deps.createAuditLog }));

import { POST } from "@/app/api/admin/attestations/[id]/actions/route";
import { ApiErrorImpl, handleApiError } from "@/lib/error-handler";
import { makeRequest } from "../helpers/request";

/* --------------------------------------------------------------- fixtures */

/**
 * Erreur Prisma réaliste : violation de contrainte d'unicité (P2002). C'est
 * précisément la famille de messages qui fuitait — elle contient le nom de
 * l'invocation Prisma, le modèle, les colonnes et la VALUE fautive.
 */
const LEAKED_VALUE = "FSA-2026-M09-00001-abcde";

function prismaUniqueConstraintError(): Error {
  const error = new Error(
    "Invalid `prisma.attestation.update()` invocation:\n\n" +
      "Unique constraint failed on the fields: (`code`)\n" +
      `DETAIL: Key (code)=(${LEAKED_VALUE}) already exists.`,
  );
  error.name = "PrismaClientKnownRequestError";
  return Object.assign(error, {
    code: "P2002",
    meta: { modelName: "Attestation", target: ["code"] },
  });
}

/** Chaque fragment interne qu'un attaquant ne doit PAS récupérer. */
const FORBIDDEN_FRAGMENTS = [
  ["le code d'erreur Prisma", "P2002"],
  ["le nom de l'invocation Prisma", "prisma.attestation.update"],
  ["le libellé de la contrainte", "Unique constraint failed"],
  ["le nom du modèle / de la table", "Attestation"],
  ["le nom de la colonne", "code`"],
  ["la valeur fautive", LEAKED_VALUE],
  ["le préfixe du message Prisma", "Invalid `prisma"],
] as const;

const GENERIC_PRODUCTION_MESSAGE =
  "Une erreur est survenue. Veuillez réessayer plus tard.";

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: "FSA-2026-OTHER-00002-zzzzz",
    userId: "user-1",
    sessionId: "session-1",
    formationId: "formation-1",
    status: "VALIDATED",
    type: "CERTIFICATION",
    deletedAt: null,
    formation: { id: "formation-1", name: "Formation A" },
    ...overrides,
  };
}

function callActions(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({ id: "att-1" }) });
}

async function bodyOf(response: Response) {
  return response.json();
}

/* ------------------------------------------------------------------ setup */

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // `handleApiError` journalise le détail complet : on capture le silence pour
  // garder la sortie du test lisible, pas pour masquer une régression (le
  // journal lui-même est vérifié plus bas).
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
  deps.createAuditLog.mockResolvedValue(undefined as never);
  deps.createNotification.mockResolvedValue(undefined as never);
  deps.notifyAllAdmins.mockResolvedValue([] as never);
  db.attestationFindUnique.mockResolvedValue(makeAttestation() as never);
  // C'est ici que Prisma échoue, en plein milieu de l'action de cycle de vie.
  db.attestationUpdate.mockRejectedValue(prismaUniqueConstraintError());
  db.examSessionUpdateMany.mockResolvedValue({ count: 0 } as never);
});

afterEach(() => {
  consoleError.mockRestore();
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ tests */

describe("#321 — fuite d'erreur technique en production", () => {
  it("la route d'action ne renvoie ni message Prisma, ni table, ni valeur en production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await callActions({
      action: "REVOKE",
      reason: "Fraude avérée",
    });

    expect(response.status).toBe(500);

    // Preuve la plus forte : la réponse est EXACTEMENT le message générique.
    // Un `details`, un `stack` ou un `context` résiduel la ferait échouer.
    const body = await bodyOf(response);
    expect(body).toEqual({
      error: GENERIC_PRODUCTION_MESSAGE,
      code: "INTERNAL_SERVER_ERROR",
    });

    // Et preuve par fragments, pour nommer précisément ce qui a été masqué.
    // On sérialise tout le corps : rien ne doit sortir, pas même une clé
    // `details` oubliée.
    const serialized = JSON.stringify(body);
    for (const [label, fragment] of FORBIDDEN_FRAGMENTS) {
      expect(
        serialized,
        `la réponse production ne doit pas exposer ${label} ("${fragment}")`,
      ).not.toContain(fragment);
    }
  });

  it("le détail de l'erreur est journalisé côté serveur avec son contexte", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await callActions({ action: "REVOKE", reason: "Fraude avérée" });

    // Le journal serveur porte l'erreur NON dégradée et le contexte qui permet
    // de retrouver l'action fautive (la réponse, elle, reste générique).
    const journal = consoleError.mock.calls
      .map((args: unknown[]) => args.map((a) => String(a)).join(" "))
      .join("\n");
    expect(journal).toContain("[API ERROR SEV-1]");
    expect(journal).toContain("Unique constraint failed");
    expect(journal).toContain("/api/admin/attestations/[id]/actions");
    expect(journal).toContain("lifecycle:REVOKE");
  });

  it("le détail complet est journalisé côté serveur, jamais renvoyé", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await callActions({ action: "REVOKE", reason: "Fraude avérée" });

    const journal = consoleError.mock.calls
      .map((args: unknown[]) => args.map((a) => String(a)).join(" "))
      .join("\n");
    expect(journal).toContain("[API ERROR SEV-1]");
    expect(journal).toContain("Unique constraint failed");
    expect(journal).toContain(LEAKED_VALUE);
  });

  it("en développement, le message et la stack restent visibles (aucun diagnostic perdu)", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await callActions({
      action: "REVOKE",
      reason: "Fraude avérée",
    });

    expect(response.status).toBe(500);
    const body = (await bodyOf(response)) as {
      error: string;
      code: string;
      details?: string;
    };
    expect(body.error).toContain("Unique constraint failed");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR_DEV");
    expect(body.details).toContain("PrismaClientKnownRequestError");
  });
});

describe("#321 — les erreurs MÉTIER continuent de parler au client", () => {
  it("un motif trop court reste un 400 qui explique quoi corriger, en production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await callActions({ action: "REVOKE", reason: "ab" });

    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({
      error: "Un motif de minimum 5 caractères est obligatoire.",
      code: "MOTIF_REQUIS",
    });
    // Une erreur de validation n'est pas une fuite : elle ne décrit aucun
    // détail d'infrastructure, et le formulaire en a besoin.
    expect(db.attestationUpdate).not.toHaveBeenCalled();
  });

  it("une attestation supprimée logiquement reste un 409 explicatif, en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    db.attestationFindUnique.mockResolvedValue(
      makeAttestation({ deletedAt: new Date("2026-09-01T00:00:00.000Z") }) as never,
    );

    const response = await callActions({
      action: "RETROGRADE",
      reason: "Examen à repasser",
    });

    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({
      error: "Attestation supprimée logiquement : action impossible.",
      code: "ATTESTATION_ALREADY_SOFT_DELETED",
    });
  });

  it("un handler d'erreur métier(ApiErrorImpl) garde son statut et son message, même en production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = handleApiError(
      new ApiErrorImpl("CONFLICT", "Cet examen a déjà une session."),
      { route: "/api/exams/[id]/submit", operation: "submit_exam" },
    );

    // Le mécanisme distingue le métier de la technique : un `ApiErrorImpl` est
    // par construction exposable au client, il n'est jamais masqué.
    expect(response.status).toBe(409);
    expect(await bodyOf(response)).toEqual({
      error: "Cet examen a déjà une session.",
      code: "CONFLICT",
    });
  });
});
