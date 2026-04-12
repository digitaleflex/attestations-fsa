import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    const attestation = await prisma.attestation.findUnique({
      where: { id },
      select: { userId: true, status: true }
    });

    if (!attestation) {
      return NextResponse.json({ error: "Attestation introuvable" }, { status: 404 });
    }

    if (attestation.userId !== user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // On passe en statut CLAIMED seulement si elle était VALIDATED
    if (attestation.status === "VALIDATED") {
      await prisma.attestation.update({
        where: { id },
        data: { status: "CLAIMED" }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error claiming attestation:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
