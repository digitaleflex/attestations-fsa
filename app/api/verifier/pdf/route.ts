import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";
import { verifyCertificateSeal } from "@/lib/crypto/seal";
import { attestationSealPayload } from "@/lib/attestations/proof";
import { getStorage, normalizeReadUrlTtl } from "@/lib/storage";

// #260 : URL signée courte, régénérée à la demande, jamais persistée.
const SIGNED_URL_TTL_SECONDS = normalizeReadUrlTtl(60);
const MAX_CODE_LENGTH = 50;

/**
 * Redirige vers l'URL de lecture R2/S3 générée à la demande (60 s maximum).
 * Aucune URL signée n'est stockée en base ni renvoyée par le vérificateur JSON.
 */
export async function GET(request: Request) {
  const rateLimit = await applyRateLimit(request, "verify");
  if (!rateLimit.allowed && rateLimit.response) return rateLimit.response;

  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code || code.length < 5 || code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: "Code invalide" }, { status: 400 });
  }

  const attestation = await prisma.attestation.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    include: { formation: { select: { name: true } } },
  });
  if (!attestation || !["VALIDATED", "CLAIMED"].includes(attestation.status)) {
    return NextResponse.json({ error: "PDF non disponible" }, { status: 404 });
  }
  const seal = verifyCertificateSeal(attestationSealPayload(attestation));
  if (!seal.valid || !attestation.pdfKey) {
    return NextResponse.json({ error: "PDF non probant" }, { status: 409 });
  }

  const url = await getStorage().getSignedUrl(attestation.pdfKey, SIGNED_URL_TTL_SECONDS);
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
