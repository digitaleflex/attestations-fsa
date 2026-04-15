import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { emailService } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

interface ExamSessionCandidate {
  id: string;
  finalScore?: number | null;
  score?: number;
  candidate: {
    id: string;
    name: string | null;
    email: string | null;
  };
  exam: {
    title: string | null;
    name: string;
  };
}

const BODY_PROPS = {
  examId: "examId",
  submissionId: "submissionId",
  submissionIds: "submissionIds",
  sendEmail: "sendEmail",
  sendInApp: "sendInApp",
  testEmail: "testEmail",
} as const;

const sendEmailDefault = true;
const sendInAppDefault = true;
const passingScore = 65;
const noSessionsMessage = "Aucune copie corrigée trouvée pour la notification.";
const errorMessage = "Erreur lors de l'envoi des notifications.";
const unauthorizedMessage = "Non autorisé - Admin requis";
const defaultCandidateName = "Candidat";
const transcriptLink = "/transcript";
const resultSuccessTitle = "🏆 Examen Réussi !";
const resultTitle = "📝 Résultats d'Examen";
const successMessageTemplate =
  "Félicitations ! Vous avez réussi l'examen EXAM_TITLE. Téléchargez votre relevé dans la section dédiée.";
const failureMessageTemplate =
  "Votre correction pour l'examen EXAM_TITLE est disponible. Consultez votre relevé de notes.";
const successSummaryTemplate =
  "Notifications envoyées à TOTAL candidats (SUCCESS admis, FAILURE non admis).";
const errorTemplate = "CANDIDATE: ERROR_MSG";

const createWhereFilter = (
  submissionId?: string,
  submissionIds?: string[],
  examId?: string,
): Prisma.ExamSessionWhereInput => {
  const baseFilter: Prisma.ExamSessionWhereInput = {
    status: "GRADED",
    exam: {
      type: "OFFICIAL",
    },
  };

  if (submissionId) {
    delete (baseFilter as Record<string, unknown>).exam;
    baseFilter.id = submissionId;
  } else if (submissionIds && submissionIds.length > 0) {
    delete (baseFilter as Record<string, unknown>).exam;
    baseFilter.id = { in: submissionIds };
  } else if (examId && examId !== "all") {
    baseFilter.examId = examId;
  }

  return baseFilter;
};

const extractErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
};

const buildNotificationTitle = (isSuccess: boolean): string => {
  return isSuccess ? resultSuccessTitle : resultTitle;
};

const buildNotificationMessage = (
  isSuccess: boolean,
  examTitle: string,
): string => {
  const message = isSuccess ? successMessageTemplate : failureMessageTemplate;
  return message.replace("EXAM_TITLE", examTitle);
};

const formatSummaryMessage = (
  total: number,
  success: number,
  failure: number,
): string => {
  return successSummaryTemplate
    .replace("TOTAL", String(total))
    .replace("SUCCESS", String(success))
    .replace("FAILURE", String(failure));
};

const formatErrorEntry = (candidateName: string, errorMsg: string): string => {
  return errorTemplate
    .replace("CANDIDATE", candidateName)
    .replace("ERROR_MSG", errorMsg);
};

const determinePassStatus = (finalScore?: number, score?: number): boolean => {
  const scoreValue = finalScore ?? score ?? 0;
  return scoreValue >= passingScore;
};

const getExamTitle = (exam: { title: string | null; name: string }): string => {
  return exam.title || exam.name;
};

const isPassing = determinePassStatus;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authResult = await getAdminUser(req);
    if (!authResult) {
      return NextResponse.json({ error: unauthorizedMessage }, { status: 401 });
    }

    const jsonData = await req.json();
    const examId = jsonData[BODY_PROPS.examId];
    const submissionId = jsonData[BODY_PROPS.submissionId];
    const submissionIds = jsonData[BODY_PROPS.submissionIds];
    const sendEmail = jsonData[BODY_PROPS.sendEmail] ?? sendEmailDefault;
    const sendInApp = jsonData[BODY_PROPS.sendInApp] ?? sendInAppDefault;
    const testEmail = jsonData[BODY_PROPS.testEmail];

    const whereFilter = createWhereFilter(submissionId, submissionIds, examId);

    const sessions = await prisma.examSession.findMany({
      where: whereFilter,
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        exam: {
          select: {
            title: true,
            name: true,
          },
        },
      },
    });

    if (!sessions.length) {
      return NextResponse.json({ message: noSessionsMessage }, { status: 404 });
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<string> = [];

    const processSession = async (session: ExamSessionCandidate): Promise<void> => {
      const finalScore = session.finalScore;
      const score = session.score;
      const passStatus = isPassing(finalScore ?? undefined, score);

      const candidateName = session.candidate.name ?? defaultCandidateName;
      const examTitle = getExamTitle(session.exam);

      try {
        if (sendInApp) {
          await createNotification({
            userId: session.candidate.id,
            type: "EXAM_RESULT_PUBLISHED",
            title: buildNotificationTitle(passStatus),
            message: buildNotificationMessage(passStatus, examTitle),
            link: transcriptLink,
          });
        }

        const emailAddress = testEmail ?? session.candidate.email;
        if (sendEmail && emailAddress) {
          await emailService.sendOfficialTranscriptNotification(
            emailAddress,
            candidateName,
            examTitle,
            finalScore ?? score ?? 0,
            passStatus,
          );
        }

        if (passStatus) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (err) {
        console.error(`Error notifying user ${session.candidate.id}:`, err);
        const errorMsg = extractErrorMessage(err);
        errors.push(formatErrorEntry(candidateName, errorMsg));
      }
    };

    await Promise.all(sessions.map(processSession));

    return NextResponse.json({
      success: true,
      summary: {
        total: sessions.length,
        success: successCount,
        failure: failureCount,
        errors: errors.length > 0 ? errors : null,
      },
      message: formatSummaryMessage(
        sessions.length,
        successCount,
        failureCount,
      ),
    });
  } catch (err) {
    console.error("Bulk Result Notification Error:", err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
