import { prisma } from "@/lib/prisma";
import { ENROLLMENT_ACTIVE } from "@/lib/exams/enrollment";

export type ExamEligibility = {
  eligible: boolean;
  code?:
    | "EXAM_NOT_ENROLLED"
    | "EXAM_ENROLLMENT_REVOKED"
    | "EXAM_ENROLLMENT_INVALID";
  message?: string;
};

/**
 * MOCK est ouvert aux candidats ; OFFICIAL exige une inscription explicite.
 * Le contournement admin est toujours fourni explicitement par la route.
 *
 * Comportement documenté (#256) :
 *
 * | examType | admin      | `ExamEnrollment` ACTIVE | résultat              |
 * |----------|------------|-------------------------|-----------------------|
 * | OFFICIAL | oui        | indifférent             | autorisé (contournement admin explicite) |
 * | OFFICIAL | non        | oui                     | autorisé              |
 * | OFFICIAL | non        | non / REVOKED           | REFUSÉ (403)          |
 * | MOCK     | indifférent| indifférent             | autorisé (entraînement) |
 *
 * Une inscription `REVOKED` n'ouvre aucun accès : la révocation est
 * immédiatement effective sur GET / start / draft / submit, sans relecture
 * du barème ni des sessions déjà enregistrées. Le `status` est stocké en
 * `TEXT` (jamais en enum) : une valeur inconnue est traitée comme
 * invalide et refusée, jamais comme active.
 */
export async function checkExamEligibility(input: {
  userId: string;
  examId: string;
  examType: "OFFICIAL" | "MOCK";
  isAdmin?: boolean;
}): Promise<ExamEligibility> {
  if (input.isAdmin === true || input.examType === "MOCK") {
    return { eligible: true };
  }

  const enrollment = await prisma.examEnrollment.findUnique({
    where: {
      userId_examId: { userId: input.userId, examId: input.examId },
    },
    select: { id: true, status: true },
  });

  if (enrollment) {
    if (enrollment.status === ENROLLMENT_ACTIVE) return { eligible: true };
    if (enrollment.status === "REVOKED") {
      return {
        eligible: false,
        code: "EXAM_ENROLLMENT_REVOKED",
        message: "Votre inscription à cet examen officiel a été révoquée.",
      };
    }
    return {
      eligible: false,
      code: "EXAM_ENROLLMENT_INVALID",
      message: "Votre inscription à cet examen officiel est invalide.",
    };
  }

  return {
    eligible: false,
    code: "EXAM_NOT_ENROLLED",
    message: "Vous n'êtes pas inscrit à cet examen officiel.",
  };
}

export function enrollmentForbiddenResponse(eligibility: ExamEligibility) {
  return Response.json(
    {
      error: "Accès non autorisé",
      code: eligibility.code,
      message: eligibility.message,
    },
    { status: 403 },
  );
}
