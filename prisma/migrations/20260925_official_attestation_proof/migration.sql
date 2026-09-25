-- Contrat de preuve des attestations officielles.
-- Additif : les attestations historiques (sessionId NULL, sceau v1/PDF NULL)
-- restent inchangées et ne sont ni migrées ni régénérées.
ALTER TABLE "Attestation"
    ADD COLUMN "pdfKey" TEXT,
    ADD COLUMN "pdfHash" TEXT,
    ADD COLUMN "pdfVersion" INTEGER,
    ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3),
    ADD COLUMN "sealVersion" INTEGER;

-- Une seule attestation CERTIFICATION par session. NULL reste autorisé pour
-- les documents historiques et les types non officiels.
CREATE UNIQUE INDEX "Attestation_sessionId_key" ON "Attestation"("sessionId");
DROP INDEX IF EXISTS "Attestation_sessionId_idx";

-- NOT VALID n'inspecte pas les ~40 lignes historiques, mais PostgreSQL
-- applique la contrainte à toute nouvelle ligne et à toute mise à jour future.
ALTER TABLE "Attestation"
    ADD CONSTRAINT "Attestation_certification_session_required"
    CHECK ("type" <> 'CERTIFICATION' OR "sessionId" IS NOT NULL) NOT VALID;
