import { NextResponse } from "next/server";
import { expireDueSessions, verifyCronSecret } from "@/lib/exams/cron-expire";

// Expiration sessions : ni cache ni pré-rendu, runtime Node (Prisma + timingSafeEqual).
// Route volontairement sans état et idempotente.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/exams/expire
 *
 * Bascule les sessions `IN_PROGRESS` dont `expiresAt` est atteint vers `EXPIRED`.
 * Déclenché par le cron (toutes les 5 minutes en production, cf. compose.prod.yml service `exam-expire-cron`).
 *
 * - `Authorization: Bearer $CRON_SECRET` obligatoire (401 sinon, sans mutation) ;
 * - `GET` renvoie 405 : la route ne fait que muter.
 *
 * La réponse n'expose AUCUNE donnée publique d'examen : uniquement le nombre de sessions expirées et leurs ids.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json(
      { message: "Non autorisé", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const result = await expireDueSessions(new Date());
    return NextResponse.json({
      expired: result.expired,
      ids: result.ids,
      now: result.now,
    });
  } catch (error) {
    console.error("[EXAM CRON] échec de l'expiration automatique:", error);
    return NextResponse.json(
      { message: "Erreur serveur", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

/** La route est mutante : seule la méthode POST est acceptée. */
export async function GET() {
  return NextResponse.json(
    { message: "Méthode non autorisée", code: "METHOD_NOT_ALLOWED" },
    { status: 405 },
  );
}