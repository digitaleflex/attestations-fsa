-- DropIndex
DROP INDEX "ExamSession_userId_examId_idx";

-- DropIndex
DROP INDEX "User_attestationCode_key";

-- DropIndex
DROP INDEX "User_attestationStatus_idx";

-- AlterTable
ALTER TABLE "ExamSession" DROP COLUMN "transcriptDownloadedAt",
ADD COLUMN     "observations" TEXT,
ALTER COLUMN "scorePart2" DROP DEFAULT,
ALTER COLUMN "scorePart3" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "attestationCode",
DROP COLUMN "attestationStatus",
DROP COLUMN "blockedReason",
DROP COLUMN "enrolledAt",
DROP COLUMN "lastBlockedAt";

-- Portfolio columns were only present on some legacy databases.
ALTER TABLE "User" DROP COLUMN IF EXISTS "portfolioEnabled",
DROP COLUMN IF EXISTS "portfolioSlug",
DROP COLUMN IF EXISTS "portfolioStatus";

-- DropTable (some legacy tables were never added to the migration history)
DROP TABLE IF EXISTS "ChatMessage";
DROP TABLE IF EXISTS "PortfolioProof";
DROP TABLE IF EXISTS "UserPortfolioMission";
DROP TABLE IF EXISTS "PortfolioMission";
DROP TABLE IF EXISTS "CompositionScan";
DROP TABLE IF EXISTS "Resource";
DROP TABLE IF EXISTS "SecurityLog";
DROP TABLE IF EXISTS "Waitlist";

-- DropEnum (some legacy enums were never added to the migration history)
DROP TYPE IF EXISTS "MissionType";
DROP TYPE IF EXISTS "PortfolioStatus";
DROP TYPE IF EXISTS "ProjectLevel";
DROP TYPE IF EXISTS "ResourceType";

