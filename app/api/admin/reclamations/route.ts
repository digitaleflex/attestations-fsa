import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const reclamations = await prisma.reclamation.findMany({
      include: {
        user: {
          select: { name: true, email: true }
        },
        submission: {
          include: { exam: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reclamations);
  } catch (error) {
    console.error("[ADMIN_RECLAMATIONS_GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
