import { sealCertificate, type CertificateSealPayload } from "@/lib/crypto/seal";

/** Construit le snapshot v2 depuis une ligne Prisma vérifiée. */
export function attestationSealPayload(
  attestation: Record<string, unknown> & { formation?: { name: string } | null },
): CertificateSealPayload {
  return {
    sealVersion: (attestation.sealVersion as number) ?? 1,
    code: String(attestation.code),
    type: (attestation.type as string) ?? null,
    status: (attestation.status as string) ?? null,
    sessionId: (attestation.sessionId as string) ?? null,
    userId: (attestation.userId as string) ?? null,
    formationId: (attestation.formationId as string) ?? null,
    formationName: attestation.formation?.name ?? null,
    fullName: String(attestation.fullName ?? ""),
    email: (attestation.email as string) ?? null,
    gender: (attestation.gender as string) ?? null,
    birthDate: attestation.birthDate as Date,
    birthPlace: (attestation.birthPlace as string) ?? null,
    startDate: attestation.startDate as Date,
    endDate: attestation.endDate as Date,
    issuedAt: attestation.issuedAt as Date,
    location: (attestation.location as string) ?? null,
    instructor: (attestation.instructor as string) ?? null,
    issuingCompany: (attestation.issuingCompany as string) ?? null,
    certificationHours: (attestation.certificationHours as number) ?? null,
    certificationMention: (attestation.certificationMention as string) ?? null,
    certificationObservations: (attestation.certificationObservations as string) ?? null,
    certificationScore: (attestation.certificationScore as number) ?? null,
    stageHours: (attestation.stageHours as number) ?? null,
    stageObservations: (attestation.stageObservations as string) ?? null,
    stageScore: (attestation.stageScore as number) ?? null,
    pdfKey: (attestation.pdfKey as string) ?? null,
    pdfHash: (attestation.pdfHash as string) ?? null,
    pdfVersion: (attestation.pdfVersion as number) ?? null,
    pdfGeneratedAt: attestation.pdfGeneratedAt as Date | null,
    sealHash: (attestation.sealHash as string) ?? null,
  };
}

/**
 * Rescelle une mutation de cycle de vie sans publier de nouveau PDF.
 * Réservé aux statuts non téléchargeables (CLAIMED/REJECTED/PENDING).
 */
export function mutationSealData(
  attestation: Record<string, unknown> & { formation?: { name: string } | null },
  mutation: Record<string, unknown>,
): { sealHash: string; sealedAt: Date; sealVersion: 2 } {
  const payload = attestationSealPayload({ ...attestation, ...mutation, sealVersion: 2 });
  const seal = sealCertificate(payload);
  if (!seal) throw new Error("Rescellement impossible : clé de scellement indisponible.");
  return { sealHash: seal.sealHash, sealedAt: seal.sealedAt, sealVersion: 2 };
}
