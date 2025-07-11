import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextRequest } from "next/server";

// Schéma de validation pour un signalement
const SignalementSchema = z.object({
  code: z.string().optional(),
  motif: z.string().min(1, "Le motif est obligatoire."),
  message: z.string().min(1, "Le message est obligatoire."),
  email: z.string().email("Email invalide").optional().or(z.literal("")).transform(e => e || null),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parse = SignalementSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ message: "Entrée invalide", details: parse.error.errors }, { status: 400 });
    }
    const { code, motif, message, email } = parse.data;
    const report = await prisma.report.create({
      data: {
        codeAttestation: code || null,
        motif,
        message,
        email: email || null,
      },
    });
    return NextResponse.json({ success: true, id: report.id });
  } catch (e) {
    return NextResponse.json({ message: "Erreur lors de l'enregistrement du signalement." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const countOnly = url.searchParams.get('countOnly') === '1';
  // Optionnel : filtrage par statut si vous avez un champ status
  // const status = url.searchParams.get('status');
  if (id) {
    try {
      const report = await prisma.report.findUnique({ where: { id } });
      if (!report) {
        return NextResponse.json({ message: "Signalement introuvable" }, { status: 404 });
      }
      return NextResponse.json(report);
    } catch (e) {
      return NextResponse.json({ message: "Erreur lors de la récupération du signalement." }, { status: 500 });
    }
  }
  // Si pas d'id, retourner la liste ou le nombre
  try {
    if (countOnly) {
      const count = await prisma.report.count();
      return NextResponse.json({ count });
    }
    const reports = await prisma.report.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(reports);
  } catch (e) {
    return NextResponse.json({ message: "Erreur lors de la récupération des signalements." }, { status: 500 });
  }
} 