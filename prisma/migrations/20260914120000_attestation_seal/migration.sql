-- #155 — Valeur probante du certificat : scellement HMAC-SHA256.
-- Migration ADDITIVE : deux colonnes nullables, aucun champ existant modifié.
ALTER TABLE "Attestation" ADD COLUMN "sealHash" TEXT;
ALTER TABLE "Attestation" ADD COLUMN "sealedAt" TIMESTAMP(3);
