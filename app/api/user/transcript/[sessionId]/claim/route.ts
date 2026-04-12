import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { sessionId: id } = await params;

    const session = await prisma.examSession.findUnique({
      where: { id },
      select: { userId: true, status: true, transcriptDownloadedAt: true }
    });

    if (!session) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Marquer l'heure du premier téléchargement
    if (!session.transcriptDownloadedAt) {
      await prisma.examSession.update({
        where: { id },
        data: { transcriptDownloadedAt: new Date() }
      });
    }

    return NextResponse.json({ success: true, alreadyDownloaded: !!session.transcriptDownloadedAt });
  } catch (error) {
    console.error("Error claiming transcript:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
