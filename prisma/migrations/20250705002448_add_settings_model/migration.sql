-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "replyTo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
