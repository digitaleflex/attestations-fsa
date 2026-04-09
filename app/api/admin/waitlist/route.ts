import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

// GET - Lister toutes les inscriptions waitlist
export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const search = searchParams.get("search");

    const where: any = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const waitlist = await prisma.waitlist.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Stats
    const [total, pending, contacted, converted] = await Promise.all([
      prisma.waitlist.count({ where }),
      prisma.waitlist.count({ where: { ...where, status: "PENDING" } }),
      prisma.waitlist.count({ where: { ...where, status: "CONTACTED" } }),
      prisma.waitlist.count({ where: { ...where, status: "CONVERTED" } }),
    ]);

    return NextResponse.json({
      waitlist,
      stats: { total, pending, contacted, converted },
    });
  } catch (error) {
    console.error("[WAITLIST_GET_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH - Mettre à jour le statut
export async function PATCH(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID et statut requis" }, { status: 400 });
    }

    const updated = await prisma.waitlist.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[WAITLIST_UPDATE_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE - Supprimer une inscription
export async function DELETE(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    await prisma.waitlist.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WAITLIST_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
