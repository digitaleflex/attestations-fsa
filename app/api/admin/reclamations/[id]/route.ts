import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { pusherServer } from "@/lib/pusher";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, adminReply } = body;

    const updated = await prisma.reclamation.update({
      where: { id },
      data: {
        status,
        adminReply,
      },
    });

    // Journal d'audit
    await createAuditLog({
      userId: adminUser?.id || "",
      action: "RECLAMATION_REPLY",
      resource: "Reclamation",
      resourceId: id,
      newValue: { status, adminReply }
    });

    // Déclenchement Pusher
    if (updated.userId) {
      await pusherServer.trigger(`user-${updated.userId}`, "notification", {
        title: "🖋️ Réponse à votre réclamation",
        message: `L'administration a traité votre demande de réclamation. État : ${status === 'ACCEPTED' ? 'Acceptée' : 'Refusée'}`
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[RECLAMATION_PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
