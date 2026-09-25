-- #256 — Champs de suivi de `ExamEnrollment`, migration STRICTEMENT ADDITIVE.
--
-- Invariants (design M9, §2) :
--   * additive        : uniquement des `ADD COLUMN IF NOT EXISTS` + un index ;
--                       aucune suppression, aucun `ALTER COLUMN`, aucun backfill ;
--   * idempotente     : ré-exécutable sans effet de bord (`IF NOT EXISTS`) ;
--   * compatible TEXT : toutes les colonnes sont `TEXT`/`TIMESTAMP(3)`, aucun
--                       `CREATE TYPE`, donc aucune conversion implicite des
--                       clés `TEXT` historiques ni du lecteur Prisma ;
--   * non destructive : les lignes existantes restent valides. `status` prend la
--                       valeur par défaut `ACTIVE`, ce qui reproduit exactement
--                       l'éligibilité d'avant ce lot (une inscription
--                       présente = inscription active) — aucune lecture
--                       d'attestation, de session ou de note n'est touchée.

ALTER TABLE "ExamEnrollment"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ADMIN_ASSIGNMENT',
    ADD COLUMN IF NOT EXISTS "grantedById" TEXT,
    ADD COLUMN IF NOT EXISTS "note" TEXT,
    ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "revokedById" TEXT,
    ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;

CREATE INDEX IF NOT EXISTS "ExamEnrollment_status_idx"
    ON "ExamEnrollment"("status");

CREATE INDEX IF NOT EXISTS "ExamEnrollment_status_examId_idx"
    ON "ExamEnrollment"("status", "examId");
