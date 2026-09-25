// Hub unique d'émission/révision/révocation des attestations de certification.
import { prisma } from "@/lib/prisma";
import { customAlphabet } from "nanoid";
import { resolveMention, isPassed } from "@/lib/exams/scoring";
import {
  CERTIFICATE_SEAL_VERSION,
  getSealSecret,
  reportSealDisabledIfProduction,
  sealCertificate,
  type CertificateSealPayload,
} from "@/lib/crypto/seal";
import { generateOfficialPdf } from "@/lib/attestations/pdf";
import type { AttestationStatus } from "@prisma/client";
import type { StorageDriver } from "@/lib/storage";
import type { CanonicalPdfGenerator } from "@/lib/attestations/pdf";

const customNanoid = customAlphabet("1234567890abcdef", 5);

export interface IssueAttestationOptions {
  generator?: CanonicalPdfGenerator;
  storage?: StorageDriver;
  now?: Date;
}

type SessionForIssue = {
  id: string;
  userId: string;
  status: string;
  type: "OFFICIAL" | "MOCK";
  finalScore: number;
  internshipScore: number;
  startedAt: Date;
  submittedAt: Date | null;
  exam: {
    type: "OFFICIAL" | "MOCK";
    passingScore: number;
    formationId: string | null;
    formation: { name: string } | null;
  };
  candidate: {
    name: string | null;
    email: string | null;
    gender: "M" | "F" | null;
    birthDate: Date | null;
    birthPlace: string | null;
  };
};

type SnapshotValues = Pick<CertificateSealPayload, "code" | "endDate" | "fullName"> & {
  status?: string;
  issuedAt?: Date;
  certificationScore?: number | null;
  certificationMention?: string | null;
  stageScore?: number | null;
  pdfKey?: string | null;
  pdfHash?: string | null;
  pdfVersion?: number | null;
  pdfGeneratedAt?: Date | null;
};

function snapshot(
  session: SessionForIssue,
  formation: { id: string; name: string },
  values: SnapshotValues,
): CertificateSealPayload {
  return {
    sealVersion: CERTIFICATE_SEAL_VERSION,
    code: values.code,
    type: "CERTIFICATION",
    status: values.status ?? "VALIDATED",
    sessionId: session.id,
    userId: session.userId,
    formationId: formation.id,
    formationName: formation.name,
    fullName: values.fullName,
    email: session.candidate.email ?? null,
    gender: session.candidate.gender ?? null,
    birthDate: session.candidate.birthDate,
    birthPlace: session.candidate.birthPlace,
    startDate: session.startedAt,
    endDate: values.endDate,
    issuedAt: values.issuedAt ?? new Date(),
    location: "En ligne (Plateforme FSA)",
    instructor: "Direction Technique FSA",
    issuingCompany: "FSA - Ferme Agro-Piscicole Cité St André",
    certificationHours: null,
    certificationMention: values.certificationMention ?? null,
    certificationObservations: null,
    certificationScore: values.certificationScore ?? null,
    stageHours: null,
    stageObservations: null,
    stageScore: values.stageScore ?? null,
    pdfKey: values.pdfKey ?? null,
    pdfHash: values.pdfHash ?? null,
    pdfVersion: values.pdfVersion ?? null,
    pdfGeneratedAt: values.pdfGeneratedAt ?? null,
  };
}

export async function issueExamAttestation(
  sessionId: string,
  options: IssueAttestationOptions = {},
): Promise<{
  created: boolean;
  updated?: boolean;
  revoked?: boolean;
  code?: string;
  error?: string;
}> {
  try {
    const session = (await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: { include: { formation: { select: { name: true } } } },
        candidate: true,
      },
    })) as unknown as SessionForIssue | null;

    if (!session) return { created: false, error: "Session non trouvée" };
    if (session.exam.type === "MOCK" || session.type === "MOCK") {
      return { created: false, error: "Émission interdite pour une session MOCK." };
    }
    if (!session.submittedAt || session.status !== "GRADED") {
      return { created: false, error: "Émission interdite : la session doit être soumise et GRADED." };
    }

    const finalScore = session.finalScore;
    const internshipScore = session.internshipScore;
    const passed = isPassed(finalScore, session.exam.passingScore);

    let formationId = session.exam.formationId;
    let formationName = session.exam.formation?.name ?? null;
    if (!formationId) {
      const defaultFormation = await prisma.formation.findFirst();
      formationId = defaultFormation?.id ?? null;
      formationName = defaultFormation?.name ?? null;
    }
    if (!formationId || !formationName) {
      return { created: false, error: "Émission impossible : Aucune formation n'est définie." };
    }
    if (!getSealSecret()) {
      reportSealDisabledIfProduction();
      return { created: false, error: "Émission bloquée : clé de scellement indisponible." };
    }

    const existing = await prisma.attestation.findFirst({
      where: { sessionId: session.id, type: "CERTIFICATION" },
    });
    const endDate = session.submittedAt;
    const mention = resolveMention(finalScore);

    if (existing) {
      const unchanged =
        existing.certificationScore === finalScore &&
        existing.stageScore === internshipScore &&
        existing.certificationMention === mention &&
        existing.status === (passed ? "VALIDATED" : "REJECTED");
      if (unchanged) return { created: false, code: existing.code };

      // Une révocation ne dépend pas du générateur PDF : le statut et le sceau
      // sont immédiatement cohérents, sans rendre un ancien PDF valide.
      let proof = {
        pdfKey: existing.pdfKey,
        pdfHash: existing.pdfHash,
        pdfVersion: existing.pdfVersion,
        pdfGeneratedAt: existing.pdfGeneratedAt,
      };
      if (passed) {
        proof = await generateOfficialPdf(
          snapshot(session, { id: formationId, name: formationName }, {
            code: existing.code,
            fullName: session.candidate.name || "Candidat Anonyme",
            status: "VALIDATED",
            endDate,
            certificationScore: finalScore,
            certificationMention: mention,
            stageScore: internshipScore,
          }),
          existing.pdfVersion,
          options,
        );
      }
      const payload = snapshot(session, { id: formationId, name: formationName }, {
        code: existing.code,
        fullName: session.candidate.name || "Candidat Anonyme",
        status: passed ? "VALIDATED" : "REJECTED",
        issuedAt: existing.issuedAt,
        endDate,
        certificationScore: finalScore,
        certificationMention: mention,
        stageScore: internshipScore,
        ...proof,
      });
      const seal = sealCertificate(payload, undefined, options.now);
      if (!seal) return { created: false, error: "Émission bloquée : clé de scellement indisponible." };

      await prisma.attestation.update({
        where: { id: existing.id },
        data: {
          certificationScore: finalScore,
          stageScore: internshipScore,
          certificationMention: mention,
          status: (passed ? "VALIDATED" : "REJECTED") as AttestationStatus,
          endDate,
          ...proof,
          ...(passed ? { pdfUrl: null } : {}),
          sealHash: seal.sealHash,
          sealedAt: seal.sealedAt,
          sealVersion: seal.sealVersion,
        },
      });
      return passed
        ? { created: false, updated: true, code: existing.code }
        : { created: false, revoked: true, code: existing.code };
    }

    if (!passed) return { created: false };

    const now = options.now ?? new Date();
    const year = now.getFullYear();
    const month = `M${String(now.getMonth() + 1).padStart(2, "0")}`;
    const count = await prisma.attestation.count({
      where: {
        issuedAt: {
          gte: new Date(year, now.getMonth(), 1),
          lt: new Date(year, now.getMonth() + 1, 1),
        },
      },
    });
    const code = `FSA-${year}-${month}-${String(count + 1).padStart(5, "0")}-${customNanoid()}`;
    const fullName = session.candidate.name || "Candidat Anonyme";
    const initial = snapshot(session, { id: formationId, name: formationName }, {
      code,
      status: "VALIDATED",
      endDate,
      fullName,
      certificationScore: finalScore,
      certificationMention: mention,
      stageScore: internshipScore,
      issuedAt: now,
    });
    const proof = await generateOfficialPdf(initial, null, options);
    const payload = snapshot(session, { id: formationId, name: formationName }, {
      code,
      status: "VALIDATED",
      endDate,
      fullName,
      certificationScore: finalScore,
      certificationMention: mention,
      stageScore: internshipScore,
      issuedAt: now,
      ...proof,
    });
    const seal = sealCertificate(payload, undefined, options.now);
    if (!seal) return { created: false, error: "Émission bloquée : clé de scellement indisponible." };

    await prisma.attestation.create({
      data: {
        code,
        fullName,
        email: session.candidate.email,
        gender: session.candidate.gender,
        birthDate: session.candidate.birthDate ?? new Date(),
        birthPlace: session.candidate.birthPlace ?? "Non renseigné",
        formationId,
        type: "CERTIFICATION",
        status: "VALIDATED",
        startDate: session.startedAt,
        endDate,
        location: "En ligne (Plateforme FSA)",
        userId: session.userId,
        sessionId,
        instructor: "Direction Technique FSA",
        issuingCompany: "FSA - Ferme Agro-Piscicole Cité St André",
        certificationScore: finalScore,
        stageScore: internshipScore,
        certificationMention: mention,
        ...proof,
        sealHash: seal.sealHash,
        sealedAt: seal.sealedAt,
        sealVersion: seal.sealVersion,
      },
    });
    return { created: true, code };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue lors de la génération";
    console.error("[ISSUE_ATTESTATION_ERROR]", message);
    return { created: false, error: message };
  }
}
