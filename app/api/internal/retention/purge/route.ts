import { NextResponse } from "next/server";
import { purgeExpiredRetention, verifyCronSecret } from "@/lib/jobs/retention-purge";

// Purge de rétention RGPD : ni cache ni pré-rendu, et runtime Node (Prisma +
// timingSafeEqual via verifyCronSecret). Route volontairement sans état et
// idempotente.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/retention/purge
 *
 * Purge les données dont la conservation est échue (`retentionUntil < now`
 * pour `StoredObject`, fenêtre `AUDIT_LOG_RETENTION_DAYS` pour `AuditLog` ;
 * politique : `docs/legal/retention-policy.md`). Déclenché par le cron
 * quotidien (cf. `scripts/cron-retention-purge.sh`).
 *
 * - `Authorization: Bearer $CRON_SECRET` obligatoire (401 sinon, sans mutation) ;
 * - `GET` renvoie 405 : la route ne fait que muter.
 *
 * La réponse ne contient aucune donnée personnelle : compteurs et clés
 * opaques uniquement.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json(
      { message: "Non autorisé", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const result = await purgeExpiredRetention(new Date());

    return NextResponse.json({
      storedObjects: result.storedObjects,
      auditLogs: result.auditLogs,
      keys: result.keys,
      now: result.now,
    });
  } catch (error) {
    console.error("[RETENTION] échec de la purge de rétention:", error);
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
