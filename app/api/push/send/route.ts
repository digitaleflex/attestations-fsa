import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser, getCurrentUser } from "@/lib/auth";

async function resolveAdmin(request: Request) {
  try {
    const admin = await getAdminUser(request);
    if (admin) return admin;
  } catch {
    // ignore
  }
  try {
    if (typeof getCurrentUser === "function") {
      const current = await getCurrentUser(request);
      if (
        current &&
        (String(current.role || "").toLowerCase() === "admin" ||
          String(current.role || "").toLowerCase() === "administrator")
      ) {
        return current;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function POST(request: Request) {
  const adminUser = await resolveAdmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const title = body?.title || body?.notification?.title;
    const message = body?.message || body?.body || body?.notification?.body;
    const url = body?.url || body?.link || "/admin";

    if (!title && !message) {
      return NextResponse.json(
        { error: "title ou message requis" },
        { status: 400 },
      );
    }

    const model: any = (prisma as any).pushSubscription;
    const subscriptions =
      model && typeof model.findMany === "function"
        ? await model.findMany()
        : [];

    // Tentative d'envoi réel via web-push si disponible (optionnel).
    let webpush: any = null;
    try {
      // @ts-expect-error - optional dependency
      webpush = await import("web-push");
    } catch {
      webpush = null;
    }

    if (webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:admin@example.com",
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY,
        );
      } catch {
        // ignore
      }
      await Promise.all(
        subscriptions.map(async (sub: any) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              JSON.stringify({ title, body: message, url }),
            );
          } catch (err) {
            console.error("[push/send] sendNotification failed:", err);
          }
        }),
      );
    }

    return NextResponse.json(
      {
        success: true,
        sent: subscriptions.length,
        count: subscriptions.length,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("[push/send] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
