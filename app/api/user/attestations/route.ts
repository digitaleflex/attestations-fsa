import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AttestationType, AttestationStatus } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";

// Schéma de validation des paramètres
const QuerySchema = z.object({
  status: z.nativeEnum(AttestationStatus).optional().or(z.literal("all")),
  type: z.nativeEnum(AttestationType).optional().or(z.literal("all")),
  limit: z.coerce.number().min(1).max(100).optional(),
});

interface AttestationStats {
  total: number;
  validated: number;
  pending: number;
  rejected: number;
}

interface AttestationWithFormation {
  id: string;
  formationId: string | null;
  status: string;
  code: string;
  isLocked?: boolean;
}

interface SessionWithExam {
  exam: {
    formationId: string | null;
    showResults: boolean;
  };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userId = user.id;

    // Validation avec Zod (Sécurité Totale)
    const url = new URL(request.url);
    const params = QuerySchema.safeParse({
      status: url.searchParams.get("status") || undefined,
      type: url.searchParams.get("type") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    });

    if (!params.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: params.error.format() },
        { status: 400 },
      );
    }

    const { status: statusParam, type: typeParam, limit } = params.data;

    // Mapping des Enums
    const status =
      statusParam && statusParam !== "all"
        ? (statusParam as AttestationStatus)
        : undefined;
    const type =
      typeParam && typeParam !== "all"
        ? (typeParam as AttestationType)
        : undefined;

    // Récupérer les attestations directement par userId (Optimisé par Index)
    const attestations = await prisma.attestation.findMany({
      where: {
        userId: userId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
      },
      include: {
        formation: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      ...(limit ? { take: limit } : {}),
    });

    // Optimisation : Récupérer toutes les sessions d'examen officielles de l'utilisateur en une seule requête
    const sessions = await prisma.examSession.findMany({
      where: {
        userId: userId,
        exam: {
          formationId: {
            in: attestations.map((a: { formationId: string | null }) => a.formationId).filter((id: string | null): id is string => !!id),
          },
          type: "OFFICIAL",
        },
      },
      include: {
        exam: {
          select: {
            formationId: true,
            showResults: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    // Mapper les attestations avec l'état de verrouillage calculé en mémoire
    const enhancedAttestations = (attestations as unknown as AttestationWithFormation[]).map((att) => {
      // Trouver la session la plus récente pour cette formation
      const session = (sessions as unknown as SessionWithExam[]).find(
        (s) => s.exam.formationId === att.formationId,
      );

      // Si showResults est false, l'attestation est verrouillée
      const isLocked = session ? !session.exam.showResults : false;
      const isPublic = (att.status === "VALIDATED" || att.status === "CLAIMED") && !isLocked;

      return {
        ...att,
        isLocked,
        // Sécurité : Masquer le code officiel si l'attestation n'est pas encore prête/validée
        code: isPublic ? att.code : "••••-••••-••••",
      };
    });

    // Calcul des statistiques (en mémoire) - Type Safe
    const stats: AttestationStats = {
      total: attestations.length,
      validated: enhancedAttestations.filter(
        (a) => a.status === "VALIDATED" && !a.isLocked,
      ).length,
      pending: enhancedAttestations.filter(
        (a) =>
          a.status === "PENDING" || (a.status === "VALIDATED" && a.isLocked),
      ).length,
      rejected: enhancedAttestations.filter((a) => a.status === "REJECTED")
        .length,
    };

    return NextResponse.json({
      attestations: enhancedAttestations,
      stats,
    });
  } catch (error: unknown) {
    console.error("Erreur attestations user:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des attestations",
      },
      { status: 500 },
    );
  }
}
