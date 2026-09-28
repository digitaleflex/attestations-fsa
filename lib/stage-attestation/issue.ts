// lib/stage-attestation/issue.ts
// Génération d'une attestation de stage : préconditions, idempotence et
// atomicité applicative.
//
// #265 — Idempotence par demande de stage.
//   Le modèle `Attestation` ne porte AUCUN lien vers `InternshipRequest`
//   (le seul `@@unique([sessionId])` ne s'applique pas aux attestations de
//   stage : `sessionId` y est `null`) et aucune migration n'est autorisée.
//   L'idempotence est donc garantie APPLICATIVEMENT : la transition
//   `InternshipRequest.status : ACCEPTED -> ARCHIVED` sert de JETON
//   d'émission, re-vérifié à l'intérieur d'une transaction sérialisable.
//   Deux appels concurrents ne peuvent donc pas émettre deux attestations.

import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { sanitizeInput } from "@/lib/sanitization";
import { getSealSecret, reportSealDisabledIfProduction, sealCertificate } from "@/lib/crypto/seal";
import {
  STAGE_LIMITS,
  validateStageAttestationInput,
  type StageAttestationInput,
  type ValidationFailure,
} from "./validation";

const nanoid = customAlphabet("1234567890abcdef", 5);

/** Statut unique autorisant l'émission. */
const ISSUABLE_STATUS = "ACCEPTED";
/** Statut posé par l'émission : sert de verrou applicatif anti-doublon. */
const CONSUMED_STATUS = "ARCHIVED";

export type StageAttestationErrorCode =
  | "VALIDATION_ERROR"
  | "INTERNSHIP_NOT_FOUND"
  | "INTERNSHIP_NOT_ACCEPTED"
  | "ATTESTATION_ALREADY_ISSUED"
  | "DUPLICATE_STAGE_ATTESTATION"
  | "INCOMPLETE_IDENTITY"
  | "CONCURRENT_REQUEST"
  | "CONFIGURATION_MISSING"
  | "INTERNAL_ERROR";

export interface StageAttestationSuccess {
  ok: true;
  attestation: { id: string; code: string };
  userId: string | null;
  stageScore: number | null;
}

export interface StageAttestationFailure {
  ok: false;
  status: number;
  code: StageAttestationErrorCode;
  message: string;
  issues?: { path: string; message: string }[];
}

export type StageAttestationOutcome = StageAttestationSuccess | StageAttestationFailure;

class StageAttestationError extends Error {
  constructor(
    readonly status: number,
    readonly code: StageAttestationErrorCode,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "StageAttestationError";
  }
}

function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

// ---------------------------------------------------------------------------
// Verrou applicatif en processus
// ---------------------------------------------------------------------------

/**
 * Deux appels HTTP quasi simultanés sur la même demande_share le même
 * processus Node : on sérialise localement l'émission pour cette demande.
 * Le garde-fou réel reste la transaction sérialisable (plusieurs instances) ;
 * ceci évite simplement d，用户 inutile de charger la base en doublon.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function clearStageAttestationInFlightForTests(): void {
  inFlight.clear();
}

/**
 * Sérialise localement les émissions portant sur la même demande. Le premier
 * appel occupe la clé ; les suivants attendent son issue (donc voient le
 * statut `ARCHIVED`) au lieu de charger la base d'une seconde écriture.
 */
async function withInProcessLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = inFlight.get(key) ?? Promise.resolve();
  const marker = previous.then(
    () => undefined,
    () => undefined,
  );
  const current = marker.then(run);
  inFlight.set(key, current);
  try {
    return await current;
  } finally {
    if (inFlight.get(key) === current) inFlight.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Résolution de la formation
// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

async function resolveFormation(tx: Tx, position: string) {
  let formation = await tx.formation.findFirst({
    where: { name: { contains: position, mode: "insensitive" } },
  });
  if (formation) return formation;

  formation = await tx.formation.findFirst({ where: { category: "STAGE" } });
  if (formation) return formation;

  return tx.formation.create({
    data: {
      name: `Stage en ${position}`.slice(0, STAGE_LIMITS.position),
      category: "STAGE",
      description: "Stage pratique professionnel",
    },
  });
}

/** Identité : uniquement depuis le dossier utilisateur, jamais inventée. */
function resolveIdentity(user: { birthDate: Date | null; birthPlace: string | null } | null | undefined) {
  const birthDate = user?.birthDate;
  const birthPlace = user?.birthPlace?.trim();

  if (!birthDate || Number.isNaN(new Date(birthDate).getTime()) || !birthPlace) {
    // Aucune valeur de repli tolérée : le document officiel ne doit jamais
    // porter une date/lieu de naissance inventé.
    throw new StageAttestationError(
      409,
      "INCOMPLETE_IDENTITY",
      "Données d'identité incomplètes sur le dossier utilisateur : renseignez la date et le lieu de naissance avant d'émettre l'attestation.",
    );
  }
  if (birthPlace.length > STAGE_LIMITS.birthPlace) {
    throw new StageAttestationError(
      409,
      "INCOMPLETE_IDENTITY",
      "Lieu de naissance enregistré trop long pour être gravé sur le document.",
    );
  }

  return { birthDate, birthPlace };
}

// ---------------------------------------------------------------------------
// Émission
// ---------------------------------------------------------------------------

export interface IssueStageAttestationArgs {
  internshipRequestId: string;
  /** Corps brut : validé ici pour que l'appelant n'ait rien à valider. */
  body: unknown;
  /** Clé de lock applicative (par défaut l'id de la demande). */
  lockKey?: string;
}

export async function issueStageAttestation({
  internshipRequestId,
  body,
  lockKey,
}: IssueStageAttestationArgs): Promise<StageAttestationOutcome> {
  return withInProcessLock(lockKey ?? internshipRequestId, async () => {
    const validation = validateStageAttestationInput(body);
    if (!validation.success) {
      const failure = validation as ValidationFailure;
      throw new StageAttestationError(
        400,
        "VALIDATION_ERROR",
        "Données de génération invalides.",
        failure.issues,
      );
    }
    const input: StageAttestationInput = validation.data;

    try {
      // Le client Prisma du projet est étendu (`$extends`) : la surcharge
      // interactive n'est plus résolue par TS, on la type explicitement.
      // Signature alignée sur celle de PrismaClient (`maxWait` / `timeout` /
      // `isolationLevel`) — `maxWait` borne l'attente du pool de connexions
      // avant de lever P2028 ; il ne joue aucun rôle dans le verrou.
      const runSerializable = prisma.$transaction as unknown as <R>(
        fn: (tx: Tx) => Promise<R>,
        options?: {
          maxWait?: number;
          timeout?: number;
          isolationLevel?: Prisma.TransactionIsolationLevel;
        },
      ) => Promise<R>;

      return await runSerializable(
        async (tx) => {
          // 1. Relecture de la demande DANS la transaction : c'est là que se
          //    joue le verrou, via la bascule ACCEPTED -> ARCHIVED.
          const internship = await tx.internshipRequest.findUnique({
            where: { id: internshipRequestId },
            include: { user: true },
          });

          if (!internship) {
            throw new StageAttestationError(404, "INTERNSHIP_NOT_FOUND", "Demande de stage introuvable.");
          }

          if (internship.status === CONSUMED_STATUS) {
            throw new StageAttestationError(
              409,
              "ATTESTATION_ALREADY_ISSUED",
              "Une attestation a déjà été générée pour cette demande de stage.",
            );
          }
          if (internship.status !== ISSUABLE_STATUS) {
            throw new StageAttestationError(
              409,
              "INTERNSHIP_NOT_ACCEPTED",
              `Attestation réservée aux demandes ACCEPTED (statut actuel : ${String(internship.status)}).`,
            );
          }

          // 2. Garde-fou secondaire : une attestation STAGE pour ce stagiaire,
          //    sur la même période, émise depuis la création de la demande.
          const duplicate = await tx.attestation.findFirst({
            where: {
              type: "STAGE",
              userId: internship.userId,
              startDate: new Date(input.startDate),
              endDate: new Date(input.endDate),
              ...(internship.userId ? {} : { fullName: internship.fullName }),
              issuedAt: { gte: internship.createdAt },
            },
            select: { id: true, code: true },
          });
          if (duplicate) {
            throw new StageAttestationError(
              409,
              "DUPLICATE_STAGE_ATTESTATION",
              "Une attestation de stage couvrant déjà cette période existe pour ce demandeur.",
            );
          }

          // 3. Données de support strictement réelles : identité + réglages.
          const { birthDate, birthPlace } = resolveIdentity(internship.user);
          const settings = await tx.settings.findFirst();

          const location = input.location ?? settings?.location?.trim();
          const instructor = input.instructor ?? settings?.instructorName?.trim();
          const issuingCompany = settings?.institutionName?.trim();

          if (!location || !instructor || !issuingCompany) {
            throw new StageAttestationError(
              500,
              "CONFIGURATION_MISSING",
              "Réglages de l'établissement incomplets : localisation, responsable ou nom de l'établissement manquant.",
            );
          }

          const formation = await resolveFormation(tx, internship.position);

          // 4. Code lisible + empreinte aléatoire.
          const now = new Date();
          const year = now.getFullYear();
          const month = `M${String(now.getMonth() + 1).padStart(2, "0")}`;
          // #316 — nextval() est atomique et évite les P2002 en concurrence.
          const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`
            SELECT nextval('attestation_code_seq') AS nextval
          `;
          const code = `FSA-${year}-${month}-${String(Number(nextval)).padStart(5, "0")}-${nanoid()}`;

          // #288 — Garde duco : le scellement est OBLIGATOIRE, y compris en dev.
          // L'écriture conditionnelle du sceau créait une attestation non
          // scellée en silence. Même refus dur que le hub d'émission des
          // certifications (`lib/attestations/issue.ts:150-153`) : l'exception
          // est levée DANS la transaction, donc la demande n'est pas non
          // plus archivée (jeton `ACCEPTED` intact) et rien n'est écrit.
          if (!getSealSecret()) {
            reportSealDisabledIfProduction();
            throw new StageAttestationError(
              503,
              "CONFIGURATION_MISSING",
              "Émission bloquée : clé de scellement indisponible.",
            );
          }

          // #300 — bascule v2 : le snapshot inclut désormais tous les champs.
          const seal = sealCertificate({
            code,
            fullName: internship.fullName,
            type: "STAGE",
            status: "VALIDATED",
            formationId: formation.id,
            formationName: formation.name,
            email: internship.email ?? null,
            gender: internship.user?.gender ?? null,
            birthDate,
            birthPlace,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            location,
            instructor,
            issuingCompany,
            stageScore: input.stageScore ?? null,
            stageObservations: input.stageObservations ?? null,
            userId: internship.userId,
            sealVersion: 2,
          });
          // Défense en profondeur (cf. `lib/attestations/issue.ts:264`).
          if (!seal) {
            throw new StageAttestationError(
              503,
              "CONFIGURATION_MISSING",
              "Émission bloquée : clé de scellement indisponible.",
            );
          }

          // 5. Création — puis bascule du jeton de statut.
          const attestation = await tx.attestation.create({
            data: {
              code,
              type: "STAGE",
              fullName: internship.fullName,
              birthDate,
              birthPlace,
              formationId: formation.id,
              startDate: new Date(input.startDate),
              endDate: new Date(input.endDate),
              location,
              instructor,
              issuingCompany,
              status: "VALIDATED",
              // Aucune valeur par défaut inventée : sans saisie admin, la note
              // et les observations restent absentes du document.
              stageScore: input.stageScore ?? null,
              stageObservations: input.stageObservations ? sanitizeInput(input.stageObservations) : null,
              userId: internship.userId,
              // #300 — sceau v2 appliqué sur toutes les voies.
              sealHash: seal.sealHash,
              sealedAt: seal.sealedAt,
              sealVersion: seal.sealVersion,
            },
            select: { id: true, code: true },
          });

          const claimed = await tx.internshipRequest.updateMany({
            where: { id: internshipRequestId, status: ISSUABLE_STATUS },
            data: { status: CONSUMED_STATUS },
          });
          if (claimed.count !== 1) {
            // Filet de sécurité : la ligne a changé entre la lecture et
            // l'écriture (émission concurrente aboutie entre-temps).
            throw new StageAttestationError(
              409,
              "CONCURRENT_REQUEST",
              "Émission concurrente détectée : une autre attestation a été générée pour cette demande.",
            );
          }

          return {
            ok: true as const,
            attestation,
            userId: internship.userId,
            stageScore: input.stageScore ?? null,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 },
      );
    } catch (error) {
      if (error instanceof StageAttestationError) throw error;

      // Conflit de sérialisation / violation d'unicité : un autre appel a
      // gagné la course. Réponse 409, aucun doublon.
      if (isPrismaError(error) && (error.code === "P2034" || error.code === "P2002")) {
        throw new StageAttestationError(
          409,
          "CONCURRENT_REQUEST",
          "Émission concurrente détectée : une autre attestation a été générée pour cette demande.",
        );
      }
      throw error;
    }
  });
}

export { StageAttestationError };
