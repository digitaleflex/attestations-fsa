import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { openDueScheduledExams, verifyCronSecret } from "@/lib/exams/cron-open";

// Ouverture planifiée : ni cache ni pré-rendu, et runtime Node (Prisma +
// timingSafeEqual). La route est volontairement sans état et idempotente.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/exams/open
 *
 * Bascule les examens `SCHEDULED` dont `scheduledAt` est atteint vers
 * `PUBLISHED`. Déclenché par le cron (toutes les 5 minutes en production,
 * cf. compose.prod.yml service `exam-cron`).
 *
 * - `Authorization: Bearer $CRON_SECRET` obligatoire (401 sinon, sans mutation) ;
 * - `GET` renvoie 405 : la route ne fait que muter.
 *
 * La réponse ne contient aucune donnée publique d'examen (ni titre, ni barème,
 * ni description, ni questions) : uniquement le nombre d'examens ouverts et
 * leurs ids.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json(
      { message: "Non autorisé", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const result = await openDueScheduledExams(new Date());

    // Le cache des examens (pages publiques + API publique) est invalidé même
    // quand rien n'a été ouvert : un cron qui vient de démarrer doit purger un
    // éventuel cache obsolète sans attendre le prochain déclenchement.
    revalidateTag("exams", { expire: 0 });

    return NextResponse.json({
      opened: result.opened,
      ids: result.ids,
      now: result.now,
    });
  } catch (error) {
    console.error("[EXAM CRON] échec de l'ouverture automatique:", error);
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
