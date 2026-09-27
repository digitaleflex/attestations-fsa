-- #299 / #301 — Cycle de vie des attestations NON destructif.
--
-- 1. `AttestationStatus.REVOKED` : la révocation devient un état explicite,
--    distinct de `REJECTED`. `ALTER TYPE ... ADD VALUE` est retrocompatible :
--    les lignes existantes gardent leur statut, aucune donnée n'est réécrite.
--
-- 2. Colonnes de cycle de vie sur `Attestation` : suppression LOGIQUE
--    (`deletedAt`, `deletedById`, `deleteReason`), révocation PUBLIQUE horodatée
--    (`revokedAt`, `revokedById`, `revokeReason`) et trace de rétrogradation
--    (`retrogradedAt`, `retrogradedById`, `retrogradeReason`).
--
-- 3. Archivage des sessions probantes sur `ExamSession` : `archivedAt`,
--    `archivedById`, `archiveReason`. Une session liée à une attestation
--    officielle ne peut plus être supprimée par une rétrogradation : elle est
--    marquée, ses réponses restent lisibles.
--
-- La migration est :
--   * ADDITIVE et IDEMPOTENTE (IF NOT EXISTS partout) ;
--   * RÉTROCOMPATIBLE : toutes les colonnes sont NULLABLES, donc les ~40
--     attestations historiques se lisent sans backfill et restent vérifiables
--     (statut, PDF, hash et sceau inchangés) ;
--   * SANS RUPTURE : `@@unique([sessionId])` est conservé, aucun DROP, aucune
--     donnée n'est supprimée.
--
-- Les `*ById` sont volontairement SANS clé étrangère : une trace d'audit doit
-- survivre à la suppression du compte qui l'a produite.
--
-- Le garde SQL qui INTERDIT la suppression physique d'une attestation émise
-- n'est PAS posé ici : les harnais de test (unitaires, e2e) suppriment les
-- attestations qu'ils créent, et un trigger bloquant toute suppression
-- rendrait le nettoyage de fixtures impossible. La règle est appliquée au
-- niveau applicatif (DELETE = soft-delete obligatoire) et reste le seul point
-- à durcIR après bascule en production, sur instruction explicite.

-- 1. Révocation publique.
ALTER TYPE "AttestationStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

-- 2. Suppression logique / révocation / rétrogradation.
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "revokedById" TEXT;
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "retrogradedAt" TIMESTAMP(3);
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "retrogradedById" TEXT;
ALTER TABLE "Attestation" ADD COLUMN IF NOT EXISTS "retrogradeReason" TEXT;

-- 3. Archivage des sessions probantes (jamais de DELETE).
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

-- 4. Index d'inventaire.
CREATE INDEX IF NOT EXISTS "Attestation_deletedAt_idx" ON "Attestation"("deletedAt");
CREATE INDEX IF NOT EXISTS "Attestation_status_deletedAt_idx" ON "Attestation"("status", "deletedAt");
CREATE INDEX IF NOT EXISTS "ExamSession_archivedAt_idx" ON "ExamSession"("archivedAt");
