-- Fusion feedback 4->2 (#98/#110/#111)
-- K1: Report+Contact => Contact (canal support general, discriminant category)
ALTER TABLE "Contact" RENAME COLUMN "type" TO "category";
ALTER TABLE "Contact" ADD COLUMN "codeAttestation" TEXT,
ADD COLUMN "motif" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- K2: CorrectionRequest+Reclamation => Reclamation (canal litige, discriminant type)
ALTER TABLE "Reclamation" DROP CONSTRAINT "Reclamation_submissionId_fkey";
ALTER TABLE "Reclamation" ADD COLUMN "attestationId" TEXT,
ADD COLUMN "field" TEXT,
ADD COLUMN "newValue" TEXT,
ADD COLUMN "oldValue" TEXT,
ADD COLUMN "reason" TEXT,
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'RECLAMATION',
ALTER COLUMN "submissionId" DROP NOT NULL,
ALTER COLUMN "subject" DROP NOT NULL;
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ExamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "Attestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
