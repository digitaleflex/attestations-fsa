import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const ResourceSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  type: z.enum(["BOOK", "VIDEO", "REVISION_FILE", "OTHER"]),
  url: z.string().url("URL invalide"),
  thumbnail: z.string().optional(),
  category: z.string().optional(),
  isPublished: z.boolean().default(true),
});

// GET /api/admin/resources - Liste des ressources
export async function GET(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const resources = await prisma.resource.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error("[GET /api/admin/resources ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/admin/resources - Créer une ressource
export async function POST(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const parse = ResourceSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ error: "Données invalides", details: parse.error.errors }, { status: 400 });
    }

    const resource = await prisma.resource.create({
      data: parse.data,
    });

    // Audit log
    if (adminUser) {
      await createAuditLog({
        userId: "", // Action globale
        action: 'RESOURCE_CREATED',
        resource: 'TRAINING_RESOURCE',
        resourceId: resource.id,
        newValue: {
          title: resource.title,
          type: resource.type,
          adminId: adminUser.id
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    return NextResponse.json(resource);
  } catch (error) {
    console.error("[POST /api/admin/resources ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/admin/resources?id=...
export async function DELETE(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const old = await prisma.resource.findUnique({ where: { id } });
    await prisma.resource.delete({ where: { id } });

    // Audit log
    if (adminUser && old) {
      await createAuditLog({
        userId: "",
        action: 'RESOURCE_DELETED',
        resource: 'TRAINING_RESOURCE',
        resourceId: id,
        oldValue: { title: old.title, type: old.type },
        newValue: { adminId: adminUser.id },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/resources ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  }
}

// PATCH /api/admin/resources?id=...
export async function PATCH(request: Request) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const body = await request.json();
    const old = await prisma.resource.findUnique({ where: { id } });

    const resource = await prisma.resource.update({
      where: { id },
      data: body, // Partial update
    });

    // Audit log
    if (adminUser && old) {
      await createAuditLog({
        userId: "",
        action: 'RESOURCE_UPDATED',
        resource: 'TRAINING_RESOURCE',
        resourceId: id,
        oldValue: old,
        newValue: {
            changes: body,
            adminId: adminUser.id,
            adminName: adminUser.name
        },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown"
      });
    }

    return NextResponse.json(resource);
  } catch (error) {
    console.error("[PATCH /api/admin/resources ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
