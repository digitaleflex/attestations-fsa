import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/user/exams/session/[id]/scans - Upload d'un scan de composition
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const { url, fileName, fileSize, pageNumber } = body;

    if (!url || !fileName) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // Vérifier que la session appartient à l'utilisateur
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "Session non trouvée" }, { status: 404 });
    }

    // Créer l'entrée du scan
    const scan = await prisma.compositionScan.create({
      data: {
        submissionId: sessionId,
        url,
        fileName,
        fileSize: fileSize || 0,
        pageNumber: pageNumber || 1,
        uploadedBy: user.name || user.email || "Utilisateur",
      }
    });

    // Logging pour le monitoring admin
    await prisma.securityLog.create({
      data: {
        eventType: "EXAM_MONITORING",
        action: "COMPOSITION_SCAN_UPLOADED",
        userId: user.id,
        severity: "LOW",
        details: {
            sessionId,
            pageNumber,
            fileName,
            timestamp: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({
      message: "Fichier enregistré avec succès",
      scan
    });

  } catch (error) {
    console.error("[SCAN_UPLOAD_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

