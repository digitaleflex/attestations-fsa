import { NextResponse, NextRequest } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import {
  StageAttestationError,
  issueStageAttestation,
} from '@/lib/stage-attestation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params; // InternshipRequest ID
  const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Corps de requête JSON invalide", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    // #265 — statut ACCEPTED exigé, idempotence et anti-doublon concurrent
    //        garantis en transaction. #266 — corps validé strictement.
    const outcome = await issueStageAttestation({ internshipRequestId: id, body });

    // L'issue() ne retourne que des succès ; les refus sont des exceptions.
    if (!outcome.ok) {
      return NextResponse.json(
        { message: "Génération refusée", code: outcome.code },
        { status: outcome.status },
      );
    }

    // 🛡️ Audit Log
    await createAuditLog({
      userId: adminUser.id,
      action: 'INTERNSHIP_ATTESTATION_GENERATED' as any,
      resource: 'INTERNSHIP_ATTESTATION',
      resourceId: outcome.attestation.id,
      newValue: {
        code: outcome.attestation.code,
        internshipRequestId: id,
        userId: outcome.userId,
        stageScore: outcome.stageScore,
      },
      ipAddress,
    });

    return NextResponse.json({
      message: "Attestation de stage générée avec succès",
      code: outcome.attestation.code,
      id: outcome.attestation.id,
    });
  } catch (error) {
    if (error instanceof StageAttestationError) {
      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
          ...(error.issues ? { issues: error.issues } : {}),
        },
        { status: error.status },
      );
    }

    // #266 — aucun détail Prisma n'est renvoyé au client ; le journal serveur
    //        conserve la trace complète pour le diagnostic.
    console.error("[INTERNSHIP_ATTESTATION_ERROR]", {
      route: "admin/internships/[id]/attestation",
      operation: "issue",
      internshipRequestId: id,
      adminUserId: adminUser.id,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: "Unknown", message: String(error) },
    });

    return NextResponse.json(
      { message: "Erreur interne lors de la génération de l'attestation", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
