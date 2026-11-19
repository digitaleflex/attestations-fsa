import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

export async function POST(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const raw = await request.text();
    const params = new URLSearchParams(raw);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[PUSHER_AUTH_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}