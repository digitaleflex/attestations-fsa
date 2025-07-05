import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { code, motif, message, email } = await req.json();
    if (!motif || !message) {
      return NextResponse.json({ message: "Motif et message obligatoires." }, { status: 400 });
    }
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