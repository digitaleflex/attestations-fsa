import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAdminUser } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { ChatMessage } from "@/types";

// GET /api/chat - Récupérer l'historique
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const adminUser = await getAdminUser(req);
    const isAdmin = !!adminUser;

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    const unreadOnly = searchParams.get("unread") === "true";
    const missionId = searchParams.get("missionId"); // Nouveau: Filtrer par projet

    const where: {
      senderRole?: string;
      isRead?: boolean;
      userId?: string;
      userPortfolioMissionId?: string | null;
    } = {};
    if (isAdmin) {
      if (unreadOnly) {
        where.senderRole = "user";
        where.isRead = false;
      } else if (targetUserId) {
        where.userId = targetUserId;
      } else {
        return NextResponse.json({ error: "UserId requis pour l'admin" }, { status: 400 });
      }
    } else {
      if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
      where.userId = user.id;
    }

    if (missionId) {
      where.userPortfolioMissionId = missionId;
    } else if (!isAdmin) {
       // Si on est pas admin et qu'on ne demande pas un projet précis, 
       // on ne montre que le chat général (sans missionId) ?
       // Ou tout ? Habituellement tout. Laisons le choix à l'UI.
    }

    // Accès direct au modèle Prisma ChatMessage
    const chatModel = prisma.chatMessage;

    if (!chatModel) {
        return NextResponse.json({
            error: "Erreur d'initialisation",
            details: "Le module chatMessage n'est pas encore actif. Réessayez dans un instant."
        }, { status: 503 });
    }

    const messages = await chatModel.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 100
    });

    if (!unreadOnly && messages.length > 0) {
        const lastMessages = messages.filter((m: ChatMessage) =>
            (isAdmin && m.senderRole === "user") || (!isAdmin && m.senderRole === "admin")
        );

        if (lastMessages.length > 0) {
            try {
                await chatModel.updateMany({
                    where: {
                        id: { in: lastMessages.map((m: ChatMessage) => m.id) },
                        isRead: false
                    },
                    data: { isRead: true }
                });
            } catch (updateError) {
                console.error("Erreur read update:", updateError);
            }
        }
    }

    return NextResponse.json(messages || []);
  } catch (error: unknown) {
    console.error("DEBUG CHAT GET ERROR:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: "Erreur serveur", details: message }, { status: 500 });
  }
}

// POST /api/chat - Envoyer un message
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const adminUser = await getAdminUser(req);
    const isAdmin = !!adminUser;
    const body = await req.json();
    const { content, userId: targetUserId, attachments, missionId } = body;

    console.log(`[CHAT POST] User: ${user?.id}, Admin: ${isAdmin}, Target: ${targetUserId}`);

    if (!content && (!attachments || attachments.length === 0)) {
        return NextResponse.json({ error: "Message vide" }, { status: 400 });
    }

    const finalUserId = isAdmin ? targetUserId : user?.id;
    const senderId = isAdmin ? "ADMIN_SYSTEM" : user?.id;
    const senderRole = isAdmin ? "admin" : "user";

    if (!finalUserId) return NextResponse.json({ error: "Destinataire manquant" }, { status: 400 });
    if (!senderId) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

    const chatModel = prisma.chatMessage;

    if (!chatModel) {
        return NextResponse.json({ error: "Module chat indisponible" }, { status: 503 });
    }

    const message = await chatModel.create({
      data: {
        content: content || "",
        senderId,
        senderRole,
        userId: finalUserId,
        attachments: attachments || [],
        userPortfolioMissionId: missionId || null
      }
    });

    // Déclencher l'événement temps réel Pusher pour le chat spécifique
    try {
      if (process.env.PUSHER_APP_ID) {
        await pusherServer.trigger(`chat-${finalUserId}`, "message", message);

        // Alerte globale pour les admins s'il s'agit d'un message d'un USER
        if (senderRole === "user") {
            await pusherServer.trigger("admin-events", "message", {
                id: message.id,
                userId: finalUserId,
                content: message.content,
                time: message.createdAt
            });
        }
      }
    } catch (pusherError) {
      console.error("Erreur Pusher Chat:", pusherError);
    }

    return NextResponse.json(message);
  } catch (error: unknown) {
    console.error("DEBUG CHAT POST ERROR:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: "Erreur lors de l'envoi", details: message }, { status: 500 });
  }
}
