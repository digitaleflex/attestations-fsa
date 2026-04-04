import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { z } from "zod";

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
export async function GET() {
  try {
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

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
    const isAdmin = await isAdminAuthenticated();
    if (!isAdmin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const parse = ResourceSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ error: "Données invalides", details: parse.error.errors }, { status: 400 });
    }

    const resource = await prisma.resource.create({
      data: parse.data,
    });

    return NextResponse.json(resource);
  } catch (error) {
    console.error("[POST /api/admin/resources ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
