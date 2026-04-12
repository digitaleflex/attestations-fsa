import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { emailService } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Admin requis" },
        { status: 401 }
      );
    }

    const { examId, submissionId, submissionIds, sendEmail = true, sendInApp = true, testEmail } = await request.json();

    // 1. Trouver toutes les sessions corrigées (GRADED) d'examen OFFICIEL
    const where: any = {
      status: "GRADED",
      exam: {
        type: "OFFICIAL"
      }
    };

    if (submissionId) {
      delete where.exam; 
      where.id = submissionId;
    } else if (submissionIds && Array.isArray(submissionIds) && submissionIds.length > 0) {
      delete where.exam;
      where.id = { in: submissionIds };
    } else if (examId && examId !== "all") {
      where.examId = examId;
    }

    const sessions = await prisma.examSession.findMany({
      where,
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

    if (sessions.length === 0) {
      return NextResponse.json(
        { message: "Aucune copie corrigée trouvée pour la notification." },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // 2. Envoyer les notifications
    // On utilise Promise.allSettled pour ne pas bloquer si un email échoue
    const notificationPromises = sessions.map(async (session: any) => {
      const isSuccess = (session.finalScore || session.score || 0) >= 65;
      const candidateName = session.candidate.name || "Candidat";
      const examTitle = session.exam.title || session.exam.name;

      try {
        // notification In-App
        if (sendInApp) {
          await createNotification({
            userId: session.candidate.id,
            type: "EXAM_RESULT_PUBLISHED",
            title: isSuccess ? "🏆 Examen Réussi !" : "📝 Résultats d'Examen",
            message: isSuccess 
              ? `Félicitations ! Vous avez réussi l'examen ${examTitle}. Téléchargez votre relevé dans la section dédiée.`
              : `Votre correction pour l'examen ${examTitle} est disponible. Consultez votre relevé de notes.`,
            link: "/transcript",
          });
        }

        // Email
        if (sendEmail && (testEmail || session.candidate.email)) {
          await emailService.sendOfficialTranscriptNotification(
            testEmail || session.candidate.email,
            candidateName,
            examTitle,
            session.finalScore || session.score || 0,
            isSuccess
          );
        }

        if (isSuccess) successCount++;
        else failureCount++;
      } catch (err: any) {
        console.error(`Error notifying user ${session.candidate.id}:`, err);
        errors.push(`${candidateName}: ${err.message}`);
      }
    });

    await Promise.all(notificationPromises);

    return NextResponse.json({
      success: true,
      summary: {
        total: sessions.length,
        success: successCount,
        failure: failureCount,
        errors: errors.length > 0 ? errors : null,
      },
      message: `Notifications envoyées à ${sessions.length} candidats (${successCount} admis, ${failureCount} non admis).`,
    });
  } catch (error: any) {
    console.error("Bulk Result Notification Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi des notifications." },
      { status: 500 }
    );
  }
}
