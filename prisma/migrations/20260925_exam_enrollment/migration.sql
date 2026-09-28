-- Add explicit per-user exam eligibility without backfilling production users.
CREATE TABLE "ExamEnrollment" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamEnrollment_userId_examId_key"
    ON "ExamEnrollment"("userId", "examId");

CREATE INDEX "ExamEnrollment_examId_idx" ON "ExamEnrollment"("examId");
CREATE INDEX "ExamEnrollment_userId_idx" ON "ExamEnrollment"("userId");

ALTER TABLE "ExamEnrollment"
    ADD CONSTRAINT "ExamEnrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamEnrollment"
    ADD CONSTRAINT "ExamEnrollment_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
