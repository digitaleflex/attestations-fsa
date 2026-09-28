import { NextResponse, NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { DEFAULT_READ_URL_TTL_SECONDS, getStorage } from '@/lib/storage';
import { handleApiError } from '@/lib/error-handler';
import { applyRateLimit } from '@/lib/rate-limit';
import { buildPagination, internshipListQuerySchema, internshipStatusPatchSchema } from '@/lib/internships/schemas';
import { applyInternshipStatusChange } from '@/lib/internships/mutation';

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // #267 — la lecture paginée est bornée comme les mutations admin voisines.
  const rateLimit = await applyRateLimit(request, 'api');
  if (!rateLimit.allowed && rateLimit.response) {
    return rateLimit.response;
  }

  try {
    // #267 — pagination + filtre de statut validés (params hors enum ou
    // malformés = 400 explicite, jamais de `take` non borné).
    const { searchParams } = new URL(request.url);
    const query = internshipListQuerySchema.parse({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

    const where = query.status ? { status: query.status } : {};

    const [requests, total] = await Promise.all([
      prisma.internshipRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
      }),
      prisma.internshipRequest.count({ where }),
    ]);

    // #260 : l'URL de lecture du CV est régénérée à la demande (courte durée)
    // et n'est jamais persistée. Les demandes historiques sans `cvKey`
    // conservent leur `cvUrl` inchangé.
    const withCvUrl = await Promise.all(requests.map(async (request) => {
      if (!request.cvKey) return request;
      try {
        const url = await getStorage().getSignedUrl(request.cvKey, DEFAULT_READ_URL_TTL_SECONDS);
        return { ...request, cvUrl: url };
      } catch {
        return { ...request, cvUrl: null };
      }
    }));

    return NextResponse.json({
      requests: withCvUrl,
      pagination: buildPagination(query, total),
    });
  } catch (error) {
    // #267 — 400 de validation explicite (Zod), 500 masqué pour le reste.
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Paramètres invalides',
          code: 'INVALID_QUERY',
          details: error.errors.map((e) => ({
            field: e.path.join('.') || 'unknown',
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    return handleApiError(error, {
      route: '/api/admin/internships',
      operation: 'GET',
      userId: adminUser?.id,
      ip: request.headers.get('x-forwarded-for') || undefined,
    });
  }
}

export async function PATCH(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const rateLimit = await applyRateLimit(request, 'api');
  if (!rateLimit.allowed && rateLimit.response) {
    return rateLimit.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête JSON invalide', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  // #267 — le statut n'est plus une chaîne libre : il est validé contre l'enum
  // `InternshipStatus`. Corps illisible / statut hors enum = 400.
  const parsed = internshipStatusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Paramètres invalides',
        code: 'INVALID_INTERNSHIP_STATUS',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.') || 'unknown',
          message: e.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyInternshipStatusChange({
      id: parsed.data.id,
      to: parsed.data.status,
      adminUser,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    });

    if (!result.ok) {
      // 404 demande inconnue / 400 transition interdite.
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ...(result.request ?? {}),
      previousStatus: result.previousStatus,
    });
  } catch (error) {
    return handleApiError(error, {
      route: '/api/admin/internships',
      operation: 'PATCH',
      userId: adminUser?.id,
      ip: request.headers.get('x-forwarded-for') || undefined,
    });
  }
}
