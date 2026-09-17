import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Dumping database...");

  const [
    users,
    accounts,
    sessions,
    verifications,
    formations,
    attestations,
    settings,
    reports,
    exams,
    examParts,
    questions,
    questionOptions,
    examSessions,
    compositionScans,
    internshipRequests,
    correctionRequests,
    securityLogs,
    auditLogs,
    notifications,
    contacts,
    reclamations,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, emailVerified: true, image: true,
        role: true, createdAt: true, updatedAt: true, banned: true, banReason: true,
        banExpires: true, address: true, birthDate: true, birthPlace: true, phone: true,
        attestationCode: true, attestationStatus: true, enrolledAt: true, examId: true,
        examScheduledAt: true, formationId: true, gender: true,
        blockedReason: true, lastBlockedAt: true,
        resetPasswordRequired: true, status: true,
        // password excluded
      },
    }),
    prisma.account.findMany({
      select: {
        id: true, userId: true, scope: true, accessToken: true, accessTokenExpiresAt: true,
        accountId: true, createdAt: true, idToken: true, providerId: true, refreshToken: true,
        refreshTokenExpiresAt: true, updatedAt: true,
        // password excluded
      },
    }),
    prisma.session.findMany({
      select: {
        id: true, userId: true, createdAt: true, expiresAt: true, ipAddress: true,
        updatedAt: true, userAgent: true, impersonatedBy: true,
        // token excluded
      },
    }),
    prisma.verification.findMany(),
    prisma.formation.findMany(),
    prisma.attestation.findMany(),
    prisma.settings.findMany(),
    prisma.report.findMany(),
    prisma.exam.findMany(),
    prisma.examPart.findMany(),
    prisma.question.findMany(),
    prisma.questionOption.findMany(),
    prisma.examSession.findMany(),
    prisma.compositionScan.findMany(),
    prisma.internshipRequest.findMany(),
    prisma.correctionRequest.findMany(),
    prisma.securityLog.findMany(),
    prisma.auditLog.findMany(),
    prisma.notification.findMany(),
    prisma.contact.findMany(),
    prisma.reclamation.findMany(),
  ]);

  const dump = {
    exportedAt: new Date().toISOString(),
    note: "passwords, session tokens excluded",
    tables: {
      users, accounts, sessions, verifications, formations, attestations,
      settings, reports, exams, examParts, questions, questionOptions,
      examSessions, compositionScans, internshipRequests,
      correctionRequests, securityLogs, auditLogs, notifications,
      contacts, reclamations,
    },
    counts: {
      users: users.length, accounts: accounts.length, sessions: sessions.length,
      verifications: verifications.length, formations: formations.length,
      attestations: attestations.length, settings: settings.length,
      reports: reports.length, exams: exams.length,
      examParts: examParts.length, questions: questions.length,
      questionOptions: questionOptions.length,
      examSessions: examSessions.length, compositionScans: compositionScans.length,
      internshipRequests: internshipRequests.length,
      correctionRequests: correctionRequests.length,
      securityLogs: securityLogs.length, auditLogs: auditLogs.length,
      notifications: notifications.length,
      contacts: contacts.length, reclamations: reclamations.length,
    },
  };

  // Write to Backup/ (gitignored), owner-only permissions
  const backupDir = path.join(process.cwd(), "Backup");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { mode: 0o700 });
  const outPath = path.join(backupDir, `db-dump-${Date.now()}.json`);
  const fd = fs.openSync(outPath, "w", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(dump, null, 2));
  } finally {
    fs.closeSync(fd);
  }

  console.log("\nRow counts:");
  Object.entries(dump.counts).forEach(([table, count]) => {
    console.log(`  ${table}: ${count}`);
  });
  console.log(`\nDump saved to: ${outPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
