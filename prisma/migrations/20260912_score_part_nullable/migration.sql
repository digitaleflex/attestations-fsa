-- Sentinelle « partie non corrigée » : scorePart2/scorePart3 deviennent nullable.
-- null = partie activée mais pas encore notée par l'admin (bloque GRADED côté API).
ALTER TABLE "ExamSession" ALTER COLUMN "scorePart2" DROP NOT NULL;
ALTER TABLE "ExamSession" ALTER COLUMN "scorePart3" DROP NOT NULL;