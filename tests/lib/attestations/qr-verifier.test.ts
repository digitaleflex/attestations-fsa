import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  attestationVerificationPath,
  attestationVerificationUrl,
  isAttestationCode,
  VERIFICATION_PATH,
} from "@/lib/attestations/verification-url";

// Code de la forme réellement émise (`FSA-<année>-M<mois>-<séquence>-<5 car>`).
const CODE = "FSA-2026-M01-00042-f0f9a";
const BASE_URL = "https://fsa.example";

// Même garde que `app/api/verifier/route.ts` (CodeSchema) : le code extrait
// du QR doit la passer avant toute recherche en base.
const VerifierCodeSchema = z
  .string()
  .min(5, "Code requis (minimum 5 caractères)")
  .max(50);

/** Même encodage que `lib/attestations/pdf-generator/index.ts:56-57`. */
async function encodeQrModules(payload: string) {
  const QRCode = await import("qrcode");
  const matrix = QRCode.create(payload, { errorCorrectionLevel: "M" });
  return matrix.modules as { size: number; get: (row: number, col: number) => number };
}

/**
 * Chaîne complète imprimée / affichée puis scannée (#141) :
 * - `CertificateTemplate.tsx:70-74` grave `${NEXT_PUBLIC_APP_URL}/verifier?code=${code}`
 *   dans `<QRCodeSVG value={verificationUrl}>` ;
 * - le PDF serveur grave `input.verificationUrl` (`lib/attestations/pdf.ts:95`).
 * Le scan d'un QR restitue cette chaîne sans perte (mode byte) : le
 * « décodage » consiste donc à la relire puis à en extraire `code`, exactement
 * comme le fait `/api/verifier` avec son paramètre de requête.
 */
describe("QR attestation — encodage → décodage → contrat /api/verifier (#141)", () => {
  it("encode le même payload côté document web et côté PDF serveur", () => {
    const serverPayload = attestationVerificationUrl(BASE_URL, CODE);
    // Construction de `CertificateTemplate.tsx:70-74` (sans encodeURIComponent,
    // identité sur l'alphabet des codes `[A-Za-z0-9-]`).
    const templatePayload = `${BASE_URL}/verifier?code=${CODE}`;
    expect(serverPayload).toBe(templatePayload);
    expect(serverPayload).toBe(`${BASE_URL}${VERIFICATION_PATH}?code=${encodeURIComponent(CODE)}`);
    expect(attestationVerificationPath(CODE)).toBe(`${VERIFICATION_PATH}?code=${CODE}`);
  });

  it("produit une matrice QR carrée et non triviale", async () => {
    const payload = attestationVerificationUrl(BASE_URL, CODE);
    const modules = await encodeQrModules(payload);
    // Taille QR : 21 + 4 × (version − 1).
    expect(modules.size).toBeGreaterThanOrEqual(21);
    expect((modules.size - 21) % 4).toBe(0);
    let dark = 0;
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) dark++;
      }
    }
    const total = modules.size * modules.size;
    expect(dark).toBeGreaterThan(0);
    expect(dark).toBeLessThan(total);
  });

  it("décodage : le scan restitue un code accepté par /api/verifier", async () => {
    const payload = attestationVerificationUrl(BASE_URL, CODE);
    await encodeQrModules(payload); // L'encodage ne doit pas rejeter le payload.
    const scanned = new URL(payload); // Ce que le scanner restitue.
    expect(scanned.pathname).toBe(VERIFICATION_PATH);
    const code = scanned.searchParams.get("code");
    expect(code).toBe(CODE);
    expect(isAttestationCode(code)).toBe(true);
    expect(() => VerifierCodeSchema.parse(code)).not.toThrow();
  });

  it("rejette les payloads altérés comme /api/verifier rejette ses paramètres", () => {
    // Mauvais chemin : le scan ne mène pas au vérificateur.
    expect(new URL(`${BASE_URL}/verify?code=${CODE}`).pathname).not.toBe(VERIFICATION_PATH);
    // Paramètre manquant ou code trop court (garde min(5) de la route).
    expect(isAttestationCode(null)).toBe(false);
    expect(VerifierCodeSchema.safeParse("FSA-").success).toBe(false);
    // Traversée de chemin : jamais un code, jamais encodé.
    expect(isAttestationCode("../../etc/passwd")).toBe(false);
    expect(() => attestationVerificationPath("pas un code")).toThrow();
  });
});
