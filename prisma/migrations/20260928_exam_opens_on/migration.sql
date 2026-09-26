-- #M9 — Ouverture planifiée des examens (design 2026-09-25).
--
-- Migration STRICTEMENT additive et idempotente :
--   * `ADD COLUMN IF NOT EXISTS` : ré-exécutable sans effet de bord ;
--   * aucun DROP, aucun TRUNCATE, aucun UPDATE massif : les examens
--     existants conservent `opensOn = NULL`, interprété à la lecture par
--     `lib/exams/time.ts` comme le jour local (APP_TIMEZONE) de `scheduledAt` ;
--   * aucune session, aucun code attesté, aucun document n'est touché.
--
-- Stockage : `TIMESTAMP(3)` aligné sur les autres `DateTime` du schéma
-- Prisma ; la valeur est TOUJOURS un instant UTC, calculé côté application.

ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "opensOn" TIMESTAMP(3);
