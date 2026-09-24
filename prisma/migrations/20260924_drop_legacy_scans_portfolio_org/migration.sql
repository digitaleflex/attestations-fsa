-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_userPortfolioMissionId_fkey";

-- DropForeignKey
ALTER TABLE "CompositionScan" DROP CONSTRAINT "CompositionScan_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "PortfolioMission" DROP CONSTRAINT "PortfolioMission_formationId_fkey";

-- DropForeignKey
ALTER TABLE "PortfolioProof" DROP CONSTRAINT "PortfolioProof_userMissionId_fkey";

-- DropForeignKey
ALTER TABLE "UserPortfolioMission" DROP CONSTRAINT "UserPortfolioMission_missionId_fkey";

-- DropForeignKey
ALTER TABLE "UserPortfolioMission" DROP CONSTRAINT "UserPortfolioMission_userId_fkey";

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
DROP COLUMN "lastBlockedAt",
DROP COLUMN "portfolioEnabled",
DROP COLUMN "portfolioSlug",
DROP COLUMN "portfolioStatus";

-- DropTable
DROP TABLE "ChatMessage";

-- DropTable
DROP TABLE "CompositionScan";

-- DropTable
DROP TABLE "PortfolioMission";

-- DropTable
DROP TABLE "PortfolioProof";

-- DropTable
DROP TABLE "Resource";

-- DropTable
DROP TABLE "SecurityLog";

-- DropTable
DROP TABLE "UserPortfolioMission";

-- DropTable
DROP TABLE "Waitlist";

-- DropEnum
DROP TYPE "MissionType";

-- DropEnum
DROP TYPE "PortfolioStatus";

-- DropEnum
DROP TYPE "ProjectLevel";

-- DropEnum
DROP TYPE "ResourceType";

