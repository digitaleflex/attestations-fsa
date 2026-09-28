"use client";

/**
 * Téléchargement du PDF officiel depuis le navigateur (#258).
 *
 * Aucun PDF n'est fabriqué côté client : le document est généré et scellé par
 * le serveur, stocké sous une clé versionnée, et le navigateur ne fait que
 * suivre la redirection vers l'URL signée de très courte durée de vie.
 *
 * La navigation est de premier niveau (et non un `fetch`) : le bucket est
 * privé et sans CORS, seul le téléchargement par le navigateur est garanti.
 */
import {
  attestationVerificationPath,
  isAttestationCode,
  officialPdfDownloadPath,
} from "@/lib/attestations/verification-url";

export { attestationVerificationPath, isAttestationCode, officialPdfDownloadPath };

/** Un document officiel n'est téléchargeable qu'une fois validé ou récupéré. */
export function isOfficialPdfDownloadable(status: string | null | undefined): boolean {
  return status === "VALIDATED" || status === "CLAIMED";
}

/**
 * Ouvre le téléchargement dans un nouvel onglet.
 * @returns `false` si le code est invalide ou si le navigateur a bloqué l'onglet.
 */
export function startOfficialPdfDownload(code: string): boolean {
  if (!isAttestationCode(code)) return false;
  const target = window.open(officialPdfDownloadPath(code), "_blank", "noopener,noreferrer");
  return target !== null || typeof target === "undefined";
}
