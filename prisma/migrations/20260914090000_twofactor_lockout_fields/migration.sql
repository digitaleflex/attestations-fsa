-- better-auth >= 1.7 `twoFactor` : champs de vérification et de verrouillage.
-- Sans ces colonnes, better-auth lève SCHEMA_MISMATCH et l'authentification
-- échoue (getSession / sign-in 500).
ALTER TABLE "TwoFactor" ADD COLUMN "verified" BOOLEAN DEFAULT true;
ALTER TABLE "TwoFactor" ADD COLUMN "failedVerificationCount" INTEGER DEFAULT 0;
ALTER TABLE "TwoFactor" ADD COLUMN "lockedUntil" TIMESTAMP(3);
