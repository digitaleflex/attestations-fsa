import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 🌍 API PUBLIQUE - Acces direct pour les etudiants
    const resources = await prisma.resource.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error("[GET /api/resources ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des ressources" }, { status: 500 });
  }
}
