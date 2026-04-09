import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminUser } from "@/lib/auth"
import { handleApiError } from "@/lib/error-handler"

/**
 * Route pour gérer un signalement spécifique
 * DELETE /api/signalement/[id]
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // ✅ Sécurité : Vérifier si l'utilisateur est admin
    const adminUser = await getAdminUser(req);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: "ID manquant" }, { status: 400 })
    }

    // Vérifier si le signalement existe
    const report = await prisma.report.findUnique({
      where: { id }
    })

    if (!report) {
      return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 })
    }

    // Suppression
    await prisma.report.delete({
      where: { id }
    })

    console.log(`[REPORT] Signalement supprimé: ${id}`)

    return NextResponse.json({ 
      success: true, 
      message: "Signalement supprimé avec succès" 
    })

  } catch (error: any) {
    console.error(`[DELETE /api/signalement/${id}] Error:`, error)
    return handleApiError(error, {
      route: `/api/signalement/${id}`,
      operation: 'delete_report',
    })
  }
}

/**
 * GET /api/signalement/[id]
 * Optionnel : pour voir les détails d'un seul signalement
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const adminUser = await getAdminUser(req);
    if (!adminUser) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const report = await prisma.report.findUnique({
      where: { id }
    })

    if (!report) {
      return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 })
    }

    return NextResponse.json(report)

  } catch (error: any) {
    return handleApiError(error, {
      route: `/api/signalement/${id}`,
      operation: 'get_single_report',
    })
  }
}
