-- #76 — Suppression défensive des colonnes legacy de User.
-- La migration 20260924_drop_legacy_scans_portfolio_org les a déjà supprimées,
-- mais certaines bases (prod, staging) peuvent ne pas l'avoir appliquée.
-- IF EXISTS rend cette migration idempotente : elle ne fait rien si les
-- colonnes sont déjà absentes.
-- examId / examScheduledAt ne sont PAS touchés (colonnes actives).

ALTER TABLE "User" DROP COLUMN IF EXISTS "attestationCode";
ALTER TABLE "User" DROP COLUMN IF EXISTS "attestationStatus";
ALTER TABLE "User" DROP COLUMN IF EXISTS "blockedReason";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastBlockedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "enrolledAt";
