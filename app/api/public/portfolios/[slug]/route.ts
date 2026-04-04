// app/api/public/portfolios/[slug]/route.ts
// API publique pour récupérer un portfolio par slug
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ error: "Slug requis" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        portfolioSlug: slug,
        portfolioEnabled: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        birthDate: true,
        birthPlace: true,
        portfolioSlug: true,
        createdAt: true,
        attestations: {
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            fullName: true,
            formation: {
              select: {
                name: true,
                description: true,
              },
            },
            startDate: true,
            endDate: true,
            scorePart1: true,
            scorePart2: true,
            totalScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        examSessions: {
          select: {
            id: true,
            status: true,
            totalScore: true,
            scorePart1: true,
            createdAt: true,
            exam: {
              select: {
                name: true,
                description: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            attestations: true,
            examSessions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Portfolio non trouvé ou non public" },
        { status: 404 }
      );
    }

    // Anonymize sensitive data
    const publicProfile = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      address: user.address,
      birthDate: user.birthDate,
      birthPlace: user.birthPlace,
      portfolioSlug: user.portfolioSlug,
      memberSince: user.createdAt,
      // Counts
      attestationCount: user._count.attestations,
      examCount: user._count.examSessions,
      // Public attestations (only VALIDATED)
      attestations: user.attestations
        .filter((a: any) => a.status === "VALIDATED")
        .map((a: any) => ({
          ...a,
          // Hide full email
          fullName: a.fullName,
        })),
      // Recent exams
      recentExams: user.examSessions.slice(0, 5),
    };

    return NextResponse.json(publicProfile);
  } catch (error) {
    console.error("[PORTFOLIO_GET_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
