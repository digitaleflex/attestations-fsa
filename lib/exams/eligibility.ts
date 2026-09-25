import { prisma } from "@/lib/prisma";

export type ExamEligibility = {
  eligible: boolean;
  code?: "EXAM_NOT_ENROLLED";
  message?: string;
};

/**
 * MOCK est ouvert aux candidats ; OFFICIAL exige une inscription explicite.
 * Le contournement admin est toujours fourni explicitement par la route.
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
    select: { id: true },
  });

  if (enrollment) return { eligible: true };

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
