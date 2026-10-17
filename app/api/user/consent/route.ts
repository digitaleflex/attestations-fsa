// app/api/user/consent/route.ts
// #153 — Registre des consentements (RGPD art. 7 / APDP Bénin)
//
// GET  -> état courant des consentements de la personne connectée
// POST -> accorde un consentement, ou révoque MARKETING
//
// La personne ne peut écrire que SES consentements : l'userId vient de la
// session, jamais du corps de la requête. Sinon n'importe qui pourrait
// consentir à la place d'un autre.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ConsentValidationError,
  CONSENT_TYPES,
  CURRENT_DOCUMENT_VERSION,
  getConsentState,
  hasRequiredConsents,
  isConsentType,
  isRevocable,
  recordConsent,
} from "@/lib/consent";

function context(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent") ?? null,
    documentVersion: CURRENT_DOCUMENT_VERSION,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const consents = await getConsentState(user.id);
  const complete = await hasRequiredConsents(user.id);

  return NextResponse.json({
    consents,
    requiredComplete: complete,
    documentVersion: CURRENT_DOCUMENT_VERSION,
    revocable: CONSENT_TYPES.filter(isRevocable),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { type?: unknown; granted?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { type, granted } = body;

  if (!isConsentType(type)) {
    return NextResponse.json(
      { error: `Type de consentement invalide. Attendu : ${CONSENT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  if (typeof granted !== "boolean") {
    return NextResponse.json({ error: "Champ \"granted\" manquant ou invalide" }, { status: 400 });
  }

  try {
    await recordConsent({
      userId: user.id,
      type,
      granted,
      ...context(request),
    });
  } catch (error) {
    if (error instanceof ConsentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[CONSENT_ERROR]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  const consents = await getConsentState(user.id);

  return NextResponse.json({ consents, requiredComplete: await hasRequiredConsents(user.id) });
}