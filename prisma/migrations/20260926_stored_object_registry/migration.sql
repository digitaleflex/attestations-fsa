-- #260 — Registre des objets stockés (bucket R2/S3 privé).
-- Migration strictement additive :
--   * aucune ligne existante n'est modifiée (les 40 attestations et les
--     InternshipRequest historiques conservent leur `cvUrl` intact) ;
--   * aucune URL signée n'est écrite ni migrée ;
--   * les PDF officiels sont proteges par le prefixe de cle `attestations/`
--     et par `purpose = 'attestation'`, jamais supprimables.

CREATE TABLE IF NOT EXISTS "StoredObject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "purpose" TEXT NOT NULL,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "contentType" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoredObject_key_key" ON "StoredObject"("key");
CREATE INDEX IF NOT EXISTS "StoredObject_ownerUserId_idx" ON "StoredObject"("ownerUserId");
CREATE INDEX IF NOT EXISTS "StoredObject_purpose_createdAt_idx" ON "StoredObject"("purpose", "createdAt");
CREATE INDEX IF NOT EXISTS "StoredObject_linkedEntityType_linkedEntityId_idx"
    ON "StoredObject"("linkedEntityType", "linkedEntityId");
CREATE INDEX IF NOT EXISTS "StoredObject_retentionUntil_idx" ON "StoredObject"("retentionUntil");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StoredObject_ownerUserId_fkey'
    ) THEN
        ALTER TABLE "StoredObject"
            ADD CONSTRAINT "StoredObject_ownerUserId_fkey"
            FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Cle stable du CV des demandes de stage. Les lignes existantes restent NULL :
-- leur `cvUrl` historique n'est ni réécrit ni supprimé.
ALTER TABLE "InternshipRequest" ADD COLUMN IF NOT EXISTS "cvKey" TEXT;
