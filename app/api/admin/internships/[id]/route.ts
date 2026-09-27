import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { handleApiError } from '@/lib/error-handler';
import { applyRateLimit } from '@/lib/rate-limit';
import { DEFAULT_READ_URL_TTL_SECONDS, getStorage } from '@/lib/storage';
import { internshipStatusSchema } from '@/lib/internships/schemas';
import {
  allowedNextInternshipStatuses,
} from '@/lib/internships/state-machine';
import { applyInternshipStatusChange } from '@/lib/internships/mutation';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * #267 — Détail d'une demande de stage + mutation de son statut.
 *
 * Renvoie aussi `allowedTransitions` : l'UI peut alors n'afficher que les
 * actions réellement permises par la machine à états
 * (`lib/internships/state-machine.ts`).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const internship = await prisma.internshipRequest.findUnique({ where: { id } });
    if (!internship) {
      return NextResponse.json(
        { error: 'Demande de stage non trouvée', code: 'INTERNSHIP_REQUEST_NOT_FOUND' },
        { status: 404 },
      );
    }

    // #260 — URL de lecture du CV régénérée à la demande, jamais persistée.
    let cvUrl: string | null = internship.cvUrl;
    if (internship.cvKey) {
      try {
        cvUrl = await getStorage().getSignedUrl(
          internship.cvKey,
          DEFAULT_READ_URL_TTL_SECONDS,
        );
      } catch {
        cvUrl = null;
      }
    }

    return NextResponse.json({
      ...internship,
      cvUrl,
      allowedTransitions: allowedNextInternshipStatuses(internship.status),
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/admin/internships/[id]',
      operation: 'GET',
      userId: adminUser?.id,
      ip: request.headers.get('x-forwarded-for') || undefined,
    });
  }
}

/**
 * #267 — Changement de statut d'une demande de stage.
 *
 * Codes de retour :
 * - 401 non admin ;
 * - 400 statut hors enum ou transition interdite par la matrice ;
 * - 404 demande inconnue ;
 * - 200 statut appliqué (ou déjà appliqué : no-op sans écriture ni audit).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rateLimit = await applyRateLimit(request, 'api');
  if (!rateLimit.allowed && rateLimit.response) {
    return rateLimit.response;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête JSON invalide', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  // Le statut peut être envoyé seul ou imbriqué (`{ status }`) : les deux
  // formes sont tolérées, la validation Zod reste identique.
  const rawStatus =
    body && typeof body === 'object' && 'status' in body
      ? (body as { status: unknown }).status
      : undefined;

  const parsedStatus = internshipStatusSchema.safeParse(rawStatus);
  if (!parsedStatus.success) {
    return NextResponse.json(
      {
        error: 'Statut de demande de stage invalide',
        code: 'INVALID_INTERNSHIP_STATUS',
        details: parsedStatus.error.errors.map((e) => ({
          field: e.path.join('.') || 'status',
          message: e.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyInternshipStatusChange({
      id,
      to: parsedStatus.data,
      adminUser,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ...(result.request ?? {}),
      previousStatus: result.previousStatus,
      allowedTransitions: allowedNextInternshipStatuses(result.status),
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/admin/internships/[id]',
      operation: 'PATCH',
      userId: adminUser?.id,
      ip: request.headers.get('x-forwarded-for') || undefined,
    });
  }
}
