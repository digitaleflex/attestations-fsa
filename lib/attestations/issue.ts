// lib/attestations/issue.ts
// Génération centralisée et idempotente des attestations de certification.
// Extraite de l'ancienne logique de correct/route.ts (hub unique).
import { prisma } from "@/lib/prisma";
import { customAlphabet } from "nanoid";
import { resolveMention, isPassed } from "@/lib/exams/scoring";
import { sealCertificate } from "@/lib/crypto/seal";
import type { AttestationStatus } from "@prisma/client";

const customNanoid = customAlphabet("1234567890abcdef", 5);

/**
 * Émet, met à jour ou révoque l'attestation CERTIFICATION d'une session d'examen.
 *
 * - Idempotent par session : la clé est (userId, formationId, type, sessionId).
 *   Une re-correction de la MÊME session met à jour score/mention/status ;
 *   une autre session de la même formation émet sa propre attestation.
 * - Si la session ne passe plus le seuil (re-correction à la baisse),
 *   l'attestation existante est révoquée (status = REJECTED).
 * - Ne throw jamais : renvoie toujours un objet résultat.
 */
export async function issueExamAttestation(sessionId: string): Promise<{
  created: boolean;
  updated?: boolean;
  revoked?: boolean;
  code?: string;
  error?: string;
}> {
  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: { include: { formation: { select: { name: true } } } },
        candidate: true,
      },
    });

    if (!session) {
      return { created: false, error: "Session non trouvée" };
    }

    const finalScore = session.finalScore;
    const internshipScore = session.internshipScore;
    const passed = isPassed(finalScore, session.exam.passingScore);

    // Résolution de la formation (fallback première formation : comportement hérité)
    let formationId: string | null = session.exam.formationId;
    let formationName: string | null = session.exam.formation?.name ?? null;
    if (!formationId) {
      const defaultFormation = await prisma.formation.findFirst();
      formationId = defaultFormation?.id ?? null;
      formationName = defaultFormation?.name ?? null;
      console.warn(
        `[ATTESTATION] Exam ${session.exam.id} has no formationId. Using default: ${formationId ?? "none"}`,
      );
    }

    if (!formationId) {
      return {
        created: false,
        error:
          "Impossible de générer l'attestation : Aucune formation n'est définie dans le système.",
      };
    }

    // IDEMPOTENCE PAR SESSION : une certification par session d'examen.
    const existing = await prisma.attestation.findFirst({
      where: {
        userId: session.userId,
        formationId,
        type: "CERTIFICATION",
        sessionId,
      },
      select: { id: true, status: true, code: true },
    });

    // Re-correction de la même session : mise à jour ou révocation.
    if (existing) {
      const endDate = session.submittedAt || new Date();
      const mention = resolveMention(finalScore);
      // Re-scellement : les données gravées changent, l'empreinte doit suivre
      // (un ancien sceau deviendrait faux sur une attestation légitimement mise à jour).
      const seal = passed
        ? sealCertificate({
            code: existing.code,
            fullName: session.candidate.name || "Candidat Anonyme",
            formationName,
            certificationScore: finalScore,
            certificationMention: mention,
            endDate,
          })
        : null;

      const data = {
        certificationScore: finalScore,
        stageScore: internshipScore,
        certificationMention: mention,
        status: (passed ? "VALIDATED" : "REJECTED") as AttestationStatus,
        endDate,
        ...(seal ? { sealHash: seal.sealHash, sealedAt: seal.sealedAt } : {}),
      };

      await prisma.attestation.update({
        where: { id: existing.id },
        data,
      });

      if (!passed) {
        return { created: false, revoked: true };
      }
      return { created: false, updated: true };
    }

    // Session non réussie sans attestation existante : rien à émettre.
    if (!passed) {
      return { created: false };
    }

    // Génération du code : séquence mensuelle + hash nanoid
    const now = new Date();
    const year = now.getFullYear();
    const month = `M${String(now.getMonth() + 1).padStart(2, "0")}`;

    const count = await prisma.attestation.count({
      where: {
        issuedAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
    });

    const seq = String(count + 1).padStart(5, "0");
    const hash = customNanoid();
    const code = `FSA-${year}-${month}-${seq}-${hash}`;
    const endDate = session.submittedAt || new Date();
    const mention = resolveMention(finalScore);

    // Scellement HMAC-SHA256 (#155) : empreinte des données gravées.
    const seal = sealCertificate({
      code,
      fullName: session.candidate.name || "Candidat Anonyme",
      formationName,
      certificationScore: finalScore,
      certificationMention: mention,
      endDate,
    });

    await prisma.attestation.create({
      data: {
        code,
        fullName: session.candidate.name || "Candidat Anonyme",
        birthDate: session.candidate.birthDate || new Date(),
        birthPlace: session.candidate.birthPlace || "Non renseigné",
        formationId,
        type: "CERTIFICATION",
        status: "VALIDATED",
        startDate: session.startedAt,
        endDate,
        location: "En ligne (Plateforme FSA)",
        userId: session.userId,
        sessionId,
        instructor: "Direction Technique FSA",
        issuingCompany: "FSA - Ferme Agro-Piscicole Cité St André",
        certificationScore: finalScore,
        stageScore: internshipScore,
        certificationMention: mention,
        ...(seal ? { sealHash: seal.sealHash, sealedAt: seal.sealedAt } : {}),
      },
    });

    return { created: true, code };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur inconnue lors de la génération";
    console.error("[ISSUE_ATTESTATION_ERROR]", error);
    return { created: false, error: message };
  }
}
