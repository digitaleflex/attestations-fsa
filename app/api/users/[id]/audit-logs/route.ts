import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    
    const logs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { timestamp: "desc" },
      take: 50, // Limit to recent 50 logs
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("[GET /api/users/[id]/audit-logs ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des logs" },
      { status: 500 }
    );
  }
}
