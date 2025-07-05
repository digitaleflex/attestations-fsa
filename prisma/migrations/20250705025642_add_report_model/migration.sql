-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "codeAttestation" TEXT,
    "motif" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'NOUVEAU',

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
