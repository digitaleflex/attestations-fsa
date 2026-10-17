-- #153 — Registre des consentements (RGPD art. 7)
--
-- Migration STRICTEMENT ADDITIVE : CREATE TYPE, CREATE TABLE, CREATE INDEX et
-- une cle etrangere. Aucune suppression de donnee : la table `Consent` est
-- neuve, `User` ne perd aucune colonne. Passe le garde
-- scripts/check-destructive-migrations.mjs sans entree de baseline.
--
-- `ON DELETE CASCADE` : si un compte est un jour supprime physiquement, ses
-- consentements partent avec lui. L'anonymisation (#291) conserve la ligne
-- `User`, donc les consentements sont conserves — c'est voulu, ils prouvent ce
-- que la personne a accepte.

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'DATA_PROCESSING', 'THIRD_PARTY_TRANSFER', 'MARKETING');

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "documentVersion" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consent_userId_type_idx" ON "Consent"("userId", "type");

-- CreateIndex
CREATE INDEX "Consent_type_grantedAt_idx" ON "Consent"("type", "grantedAt");

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
