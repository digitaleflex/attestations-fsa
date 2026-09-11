// lib/attestations/issue.ts
// Génération centralisée et idempotente des attestations de certification.
// Extraite de l'ancienne logique de correct/route.ts (hub unique).
import { prisma } from "@/lib/prisma";
import { customAlphabet } from "nanoid";

const customNanoid = customAlphabet("1234567890abcdef", 5);

type CertificationMentionValue =
  | "PASSABLE"
  | "ASSEZ_BIEN"
  | "BIEN"
  | "TRES_BIEN"
  | "EXCELLENCE";

function resolveMention(finalScore: number): CertificationMentionValue {
  if (finalScore >= 90) return "EXCELLENCE";
  if (finalScore >= 80) return "TRES_BIEN";
  if (finalScore >= 70) return "BIEN";
  if (finalScore >= 65) return "ASSEZ_BIEN";
  return "PASSABLE";
}

/**
 * Émet (ou retrouve) l'attestation CERTIFICATION d'une session d'examen.
 *
 * - Idempotent : si une attestation existe déjà pour ce user + formation + type,
 *   aucune nouvelle ligne n'est créée (évite les doublons de re-notation).
 * - Ne throw jamais : renvoie toujours un objet résultat.
 */
export async function issueExamAttestation(
  sessionId: string,
): Promise<{ created: boolean; code?: string; error?: string }> {
  try {
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: true,
        candidate: true,
      },
    });

    if (!session) {
      return { created: false, error: "Session non trouvée" };
    }

    const finalScore = session.finalScore;
    const internshipScore = session.internshipScore;

    // Résolution de la formation (fallback première formation : comportement hérité)
    let formationId: string | null = session.exam.formationId;
    if (!formationId) {
      const defaultFormation = await prisma.formation.findFirst();
      formationId = defaultFormation?.id ?? null;
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

    // IDEMPOTENCE : une seule certification par candidat et par formation.
    const existing = await prisma.attestation.findFirst({
      where: {
        userId: session.userId,
        formationId,
        type: "CERTIFICATION",
      },
      select: { id: true },
    });

    if (existing) {
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
        endDate: session.submittedAt || new Date(),
        location: "En ligne (Plateforme FSA)",
        userId: session.userId,
        instructor: "Direction Technique FSA",
        issuingCompany: "FSA - Ferme Agro-Piscicole Cité St André",
        certificationScore: finalScore,
        stageScore: internshipScore,
        certificationMention: resolveMention(finalScore),
      },
    });

    return { created: true, code };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue lors de la génération";
    console.error("[ISSUE_ATTESTATION_ERROR]", error);
    return { created: false, error: message };
  }
}
