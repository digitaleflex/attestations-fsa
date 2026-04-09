import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, subject, message } = body;

    if (!submissionId || !subject || !message) {
      return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
    }

    // Vérifier que la soumission appartient à l'utilisateur
    const submission = await prisma.examSession.findFirst({
      where: {
        id: submissionId,
        userId: userSession.id,
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Copie non trouvée" }, { status: 404 });
    }

    const reclamation = await prisma.reclamation.create({
      data: {
        userId: userSession.id,
        submissionId,
        subject,
        message,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, reclamation });
  } catch (error) {
    console.error("[RECLAMATION_POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const userSession = await getCurrentUser(request);
    if (!userSession) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const reclamations = await prisma.reclamation.findMany({
      where: { userId: userSession.id },
      include: {
        submission: {
          include: { exam: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reclamations);
  } catch (error) {
    console.error("[RECLAMATION_GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
