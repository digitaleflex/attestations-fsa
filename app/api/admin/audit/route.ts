import { NextResponse } from "next/server";
import { getCurrentUser, isAdminAuthenticated } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/admin/audit
 * Permet de logger des actions critiques depuis le client (ex: Téléchargement de PDF)
 */
export async function POST(request: Request) {
  try {
    const adminUser = await getCurrentUser(request);

    // Seul un admin peut logger des actions via cet endpoint (sécurité)
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { action, resource, resourceId, userId, details } = body;

    if (!action || !resource || !resourceId) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    await createAuditLog({
      userId: userId || "", // L'ID du candidat concerné
      action,
      resource,
      resourceId,
      newValue: {
        ...details,
        adminId: adminUser?.id,
        adminName: adminUser?.name
      },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown"
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUDIT_CLIENT_LOG_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
