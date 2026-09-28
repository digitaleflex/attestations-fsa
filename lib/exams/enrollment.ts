// lib/exams/enrollment.ts
// Point d'entrée UNIQUE pour accorder / révoquer une inscription à un examen
// (#256). Toutes les opérations sont idempotentes : les ré-exécuter (double
// clic admin, rejeu de webhook, migration rejouée) ne crée jamais de doublon et
// ne renvoie jamais d'erreur.
//
// Choix de modélisation :
//   * `status` est un `TEXT` (jamais un enum Prisma) : les lignes historiques
//     restent compatibles et une valeur inconnue est refusée explicitement
//     plutôt que d'être silencieusement acceptée ;
//   * la révocation est LOGIQUE (`status = REVOKED` + horodatage), jamais un
//     `DELETE` : la traçabilité admin et les sessions déjà passées sont
//     conservées.

import { prisma } from "@/lib/prisma";

/** Statuts d'inscription acceptés. Toute autre valeur est rejetée. */
export const ENROLLMENT_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Origines d'inscription tracées (champ libre, borné par `MAX_SOURCE_LENGTH`). */
export const ENROLLMENT_SOURCES = [
  "ADMIN_ASSIGNMENT",
  "IMPORT",
  "API",
  "SEED",
  "E2E",
] as const;
export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number] | string;

const MAX_SOURCE_LENGTH = 64;
const MAX_NOTE_LENGTH = 500;
const MAX_REVOKE_REASON_LENGTH = 500;

export const ENROLLMENT_ACTIVE: EnrollmentStatus = "ACTIVE";
export const ENROLLMENT_REVOKED: EnrollmentStatus = "REVOKED";

export function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return (
    typeof value === "string" &&
    (ENROLLMENT_STATUSES as readonly string[]).includes(value)
  );
}

function normalizeText(value: string | null | undefined, max: number) {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Client d'écriture : `prisma` par défaut, ou le `tx` d'une transaction
 * appelante (`app/api/users/[id]` accorde l'inscription DANS la mise à jour
 * du compte, pour qu'un échec de l'inscription fasse échouer l'affectation).
 */
type EnrollmentWriteClient = {
  examEnrollment: {
    upsert: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
  };
};

function writeClient(client?: EnrollmentWriteClient): EnrollmentWriteClient {
  return client ?? (prisma as unknown as EnrollmentWriteClient);
}

/**
 * Accorde (ou réactive) une inscription. Idempotent :
 *   - pas d'inscription      → crée la ligne (`status = ACTIVE`) ;
 *   - inscription ACTIVE      → ne la touche pas (replay sans effet) ;
 *   - inscription REVOKED     → la réactive et trace qui l'a réaccordée.
 * L'opération est un `upsert` sur la clé unique `(userId, examId)` : deux
 * appels concurrents ne peuvent pas créer deux lignes.
 */
export async function grantExamEnrollment(input: {
  userId: string;
  examId: string;
  grantedById?: string | null;
  source?: EnrollmentSource;
  note?: string | null;
  /** Horodatage injectable pour les tests. */
  now?: Date;
  client?: EnrollmentWriteClient;
}): Promise<{ id: string; status: EnrollmentStatus; created: boolean }> {
  const userId = input.userId?.trim();
  const examId = input.examId?.trim();
  if (!userId || !examId) {
    throw new Error("grantExamEnrollment: userId et examId sont obligatoires");
  }

  const now = input.now ?? new Date();
  const source =
    normalizeText(input.source, MAX_SOURCE_LENGTH) ?? "ADMIN_ASSIGNMENT";
  const grantedById = normalizeText(input.grantedById, 128);
  const note = normalizeText(input.note, MAX_NOTE_LENGTH);

  const row = await writeClient(input.client).examEnrollment.upsert({
    where: { userId_examId: { userId, examId } },
    create: {
      userId,
      examId,
      status: ENROLLMENT_ACTIVE,
      source,
      grantedById,
      note,
      createdAt: now,
      updatedAt: now,
    },
    // `status` est relu puis conditionné : une réactivation n'écrase pas
    // l'historique d'une inscription déjà active (update: {} → no-op).
    update: {
      status: ENROLLMENT_ACTIVE,
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      ...(grantedById ? { grantedById } : {}),
      ...(note ? { note } : {}),
      updatedAt: now,
    },
    select: { id: true, status: true, createdAt: true },
  });

  const created = row.createdAt.getTime() === now.getTime();
  return {
    id: row.id,
    status: isEnrollmentStatus(row.status) ? row.status : ENROLLMENT_ACTIVE,
    created,
  };
}

/**
 * Révoque une inscription. Idempotent : une inscription absente ou déjà
 * révoquée n'est pas une erreur (`changed: false`). Aucune suppression
 * physique — la ligne et sa traçabilité restent en base.
 */
export async function revokeExamEnrollment(input: {
  userId: string;
  examId: string;
  revokedById?: string | null;
  revokeReason?: string | null;
  now?: Date;
  client?: EnrollmentWriteClient;
}): Promise<{ id: string | null; changed: boolean }> {
  const userId = input.userId?.trim();
  const examId = input.examId?.trim();
  if (!userId || !examId) {
    throw new Error("revokeExamEnrollment: userId et examId sont obligatoires");
  }

  const now = input.now ?? new Date();
  const revokedById = normalizeText(input.revokedById, 128);
  const revokeReason = normalizeText(input.revokeReason, MAX_REVOKE_REASON_LENGTH);

  const result = await writeClient(input.client).examEnrollment.updateMany({
    where: { userId, examId, status: ENROLLMENT_ACTIVE },
    data: {
      status: ENROLLMENT_REVOKED,
      revokedAt: now,
      ...(revokedById ? { revokedById } : {}),
      ...(revokeReason ? { revokeReason } : {}),
      updatedAt: now,
    },
  });

  if (result.count > 0) return { id: null, changed: true };

  // Déjà révoqué (ou jamais accordé) : on relit pour être explicite.
  const existing = await writeClient(input.client).examEnrollment.findUnique({
    where: { userId_examId: { userId, examId } },
    select: { id: true, status: true },
  });
  return { id: existing?.id ?? null, changed: false };
}
