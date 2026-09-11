-- Aligner la contrainte d'unicite sur TwoFactor.userId.
-- Le schema Prisma declare userId String @unique (relation 1-1 better-auth),
-- mais la migration initiale ne creait qu'un index NON unique (TwoFactor_userId_idx).
-- On remplace cet index par un index unique nomme selon la convention Prisma (_key).

DROP INDEX IF EXISTS "TwoFactor_userId_idx";
CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor"("userId");
