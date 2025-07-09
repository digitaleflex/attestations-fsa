import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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