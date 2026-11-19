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
    const endpoint = body?.endpoint || body?.subscription?.endpoint;
    const keys = body?.keys || body?.subscription?.keys || {};
    const p256dh = body?.p256dh || keys?.p256dh || "";
    const auth = body?.auth || keys?.auth || "";

    if (!endpoint) {
      return NextResponse.json(
        { error: "endpoint requis" },
        { status: 400 },
      );
    }

    const model: any = (prisma as any).pushSubscription;
    const data = {
      userId: adminUser.id,
      endpoint,
      p256dh,
      auth,
      userAgent: body?.userAgent || null,
    };

    if (model && typeof model.upsert === "function") {
      await model.upsert({
        where: { endpoint },
        create: data,
        update: {
          userId: adminUser.id,
          p256dh,
          auth,
          userAgent: body?.userAgent || null,
        },
      });
    } else if (model && typeof model.create === "function") {
      // Try to avoid duplicates if a findUnique exists
      if (typeof model.findUnique === "function") {
        const existing = await model.findUnique({ where: { endpoint } });
        if (existing && typeof model.update === "function") {
          await model.update({
            where: { endpoint },
            data: { userId: adminUser.id, p256dh, auth, userAgent: body?.userAgent || null },
          });
        } else {
          await model.create({ data });
        }
      } else {
        await model.create({ data });
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    console.error("[push/subscribe] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const adminUser = await resolveAdmin(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const model: any = (prisma as any).pushSubscription;
    const items =
      model && typeof model.findMany === "function"
        ? await model.findMany({ where: { userId: adminUser.id } })
        : [];
    return NextResponse.json({ subscriptions: items });
  } catch (error: unknown) {
    console.error("[push/subscribe] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
