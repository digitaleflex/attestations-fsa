import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const corrections = await prisma.correctionRequest.findMany({
      include: {
        user: { select: { name: true, email: true } },
        attestation: { select: { code: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(corrections);
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const correction = await prisma.correctionRequest.update({
      where: { id },
      data: { status }
    });

    // Si approuvé, on peut automatiquement mettre à jour le profil de l'utilisateur
    if (status === "APPROVED") {
      const fullCorrection = await prisma.correctionRequest.findUnique({
        where: { id },
        include: { user: true }
      });

      if (fullCorrection) {
        const updateData: Record<string, unknown> = {};
        if (fullCorrection.field === "fullName") updateData.name = fullCorrection.newValue;
        if (fullCorrection.field === "birthDate") updateData.birthDate = new Date(fullCorrection.newValue);
        if (fullCorrection.field === "birthPlace") updateData.birthPlace = fullCorrection.newValue;
        
        await prisma.user.update({
          where: { id: fullCorrection.userId },
          data: updateData
        });
      }
    }

    return NextResponse.json({ success: true, data: correction });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
