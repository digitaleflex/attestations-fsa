-- #318 — Expiration des sessions d'examen.
--
-- Migration STRICTEMENT additive et idempotente :
--   * `ADD COLUMN IF NOT EXISTS` : ré-exécutable sans effet de bord ;
--   * aucun DROP, aucun TRUNCATE, aucun UPDATE massif : les sessions
--     existantes conservent `expiresAt = NULL`, interprété comme
--     « non expirable » (repli historique) ;
--   * le statut `EXPIRED` est une valeur TEXT libre (le statut est un
--     String dans le schéma, pas un enum) : aucune modification de type
--     n'est nécessaire.
--
-- Le cron `lib/exams/cron-expire.ts` bascule les sessions IN_PROGRESS
-- dont `expiresAt <= now` vers le statut EXPIRED, avec journalisation.

ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ExamSession_expiresAt_idx" ON "ExamSession"("expiresAt");
