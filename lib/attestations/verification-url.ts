/**
 * Cible unique des QR codes et des téléchargements officiels (#258).
 *
 * Module isomorphic (aucun import serveur) : il est utilisé côté serveur pour
 * graver l'URL dans le PDF officiel, et côté navigateur pour le QR affiché aux
 * candidats et à l'administration. Une seule implémentation garantit que le QR
 * du document, celui de l'interface et le lien de téléchargement public pointent
 * exactement vers la même ressource.
 */

/** Route publique de vérification d'une attestation. */
export const VERIFICATION_PATH = "/verifier";

/** Route publique de téléchargement du PDF probant. */
export const OFFICIAL_PDF_PATH = "/api/verifier/pdf";

/** Un code non conforme ne doit jamais être encodé dans une URL. */
export function isAttestationCode(code: unknown): code is string {
  return typeof code === "string" && /^FSA-[A-Za-z0-9-]+$/.test(code);
}

/** URL publique de vérification : `/verifier?code=…`. */
export function attestationVerificationPath(code: string): string {
  if (!isAttestationCode(code)) throw new Error("Code d'attestation invalide.");
  return `${VERIFICATION_PATH}?code=${encodeURIComponent(code)}`;
}

/** URL publique de téléchargement du PDF : `/api/verifier/pdf?code=…`. */
export function officialPdfDownloadPath(code: string): string {
  if (!isAttestationCode(code)) throw new Error("Code d'attestation invalide.");
  return `${OFFICIAL_PDF_PATH}?code=${encodeURIComponent(code)}`;
}

/** URL absolue de vérification, gravée dans le QR du PDF officiel. */
export function attestationVerificationUrl(baseUrl: string, code: string): string {
  const origin = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(origin)) {
    throw new Error("NEXT_PUBLIC_APP_URL doit être une URL absolue http(s).");
  }
  return `${origin}${attestationVerificationPath(code)}`;
}
