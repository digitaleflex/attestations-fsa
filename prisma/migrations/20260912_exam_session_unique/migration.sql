-- Migration: unicité ExamSession(userId, examId) — #121
-- 1. Dédupliquer les éventuelles sessions multiples (garder la plus récente)
--    par (userId, examId) avant de poser la contrainte unique.
DELETE FROM "ExamSession" a
USING "ExamSession" b
WHERE a."userId" = b."userId"
  AND a."examId" = b."examId"
  AND a."updatedAt" < b."updatedAt";

-- 2. Contrainte unique (nom Prisma : ExamSession_userId_examId_key)
CREATE UNIQUE INDEX "ExamSession_userId_examId_key" ON "ExamSession"("userId", "examId");