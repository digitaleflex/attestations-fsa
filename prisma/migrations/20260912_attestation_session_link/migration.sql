-- Lier chaque attestation CERTIFICATION à la session d'examen qui l'a émise.
-- Permet la clé d'idempotence par session (re-correction : mise à jour / révocation).

ALTER TABLE "Attestation" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "Attestation_sessionId_idx" ON "Attestation"("sessionId");
