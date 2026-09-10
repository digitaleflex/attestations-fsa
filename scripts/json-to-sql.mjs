#!/usr/bin/env node
/**
 * Convert db-dump JSON to SQL INSERT statements
 * v4: Handles FK deferral, array escaping, JSONB escaping, specific column types
 */
import fs from "fs";
import crypto from "crypto";

const dumpFile = process.argv[2];
if (!dumpFile) {
  console.error("Usage: node scripts/json-to-sql.mjs <dump.json>");
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(dumpFile, "utf8"));
console.log(`-- Generated from: ${dumpFile}`);
console.log(`-- Exported at: ${dump.exportedAt}`);
console.log(
  `-- Total users: ${dump.counts.users}, attestations: ${dump.counts.attestations}\n`,
);

// Disable FK checks for the import
console.log("SET session_replication_role = replica;\n");

// Columns that should be cast as jsonb instead of text[]
const JSONB_COLUMNS = new Set([
  "attachments",
  "metadata",
  "answers",
  "details",
  "oldValue",
  "newValue",
]);

function sqlEscape(val, columnName) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);

  // Array handling
  if (Array.isArray(val)) {
    // jsonb array column
    if (JSONB_COLUMNS.has(columnName)) {
      if (val.length === 0) return "'[]'::jsonb";
      const json = JSON.stringify(val)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
      return `E'${json.replace(/'/g, "''")}'::jsonb`;
    }
    // PostgreSQL text array
    if (val.length === 0) return "'{}'::text[]";
    const items = val
      .map((v) => `"${String(v).replace(/"/g, '\\"').replace(/'/g, "''")}"`)
      .join(",");
    return `'{${items}}'::text[]`;
  }

  // Object → JSONB
  if (typeof val === "object") {
    const json = JSON.stringify(val)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return `E'${json.replace(/'/g, "''")}'::jsonb`;
  }

  // String → escape
  const str = String(val).replace(/\\/g, "\\\\").replace(/'/g, "''");
  return `E'${str}'`;
}

function genInsert(table, rows, fields) {
  if (!rows || rows.length === 0) return "";
  const cols = fields.map((f) => `"${f}"`).join(", ");
  let sql = "";
  for (const row of rows) {
    const values = fields.map((f) => sqlEscape(row[f], f)).join(", ");
    sql += `INSERT INTO "${table}" (${cols}) VALUES (${values}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  return sql;
}

function dummyToken() {
  return crypto.randomBytes(32).toString("hex");
}

const sessions = dump.tables.sessions.map((s) => ({
  ...s,
  token: s.token || dummyToken(),
}));

const tables = [
  [
    "Formation",
    dump.tables.formations,
    ["id", "name", "category", "description", "skills", "createdAt"],
  ],
  [
    "Settings",
    dump.tables.settings,
    [
      "id",
      "institutionName",
      "replyTo",
      "updatedAt",
      "targetAttestations",
      "targetInscriptions",
      "targetValidations",
      "institutionLogo",
      "instructorName",
      "instructorTitle",
      "location",
      "signatureUrl",
      "supportEmail",
    ],
  ],
  [
    "User",
    dump.tables.users,
    [
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "role",
      "createdAt",
      "updatedAt",
      "banned",
      "banReason",
      "banExpires",
      "address",
      "birthDate",
      "birthPlace",
      "phone",
      "attestationCode",
      "attestationStatus",
      "enrolledAt",
      "examId",
      "examScheduledAt",
      "formationId",
      "gender",
      "blockedReason",
      "lastBlockedAt",
      "resetPasswordRequired",
      "status",
    ],
  ],
  [
    "Account",
    dump.tables.accounts,
    [
      "id",
      "userId",
      "scope",
      "accessToken",
      "accessTokenExpiresAt",
      "accountId",
      "createdAt",
      "idToken",
      "providerId",
      "refreshToken",
      "refreshTokenExpiresAt",
      "updatedAt",
    ],
  ],
  [
    "Session",
    sessions,
    [
      "id",
      "userId",
      "token",
      "createdAt",
      "expiresAt",
      "ipAddress",
      "updatedAt",
      "userAgent",
      "impersonatedBy",
    ],
  ],
  [
    "Verification",
    dump.tables.verifications,
    ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
  ],
  [
    "Report",
    dump.tables.reports,
    [
      "id",
      "codeAttestation",
      "motif",
      "message",
      "email",
      "createdAt",
      "status",
    ],
  ],
  [
    "Contact",
    dump.tables.contacts,
    [
      "id",
      "name",
      "email",
      "phone",
      "subject",
      "message",
      "status",
      "type",
      "createdAt",
      "updatedAt",
    ],
  ],
  [
    "Notification",
    dump.tables.notifications,
    [
      "id",
      "userId",
      "type",
      "title",
      "message",
      "isRead",
      "link",
      "metadata",
      "createdAt",
    ],
  ],
  [
    "SecurityLog",
    dump.tables.securityLogs,
    [
      "id",
      "eventType",
      "userId",
      "ipAddress",
      "userAgent",
      "resource",
      "resourceId",
      "action",
      "status",
      "severity",
      "details",
      "timestamp",
    ],
  ],
  [
    "AuditLog",
    dump.tables.auditLogs,
    [
      "id",
      "userId",
      "action",
      "resource",
      "resourceId",
      "oldValue",
      "newValue",
      "ipAddress",
      "timestamp",
    ],
  ],
  [
    "Attestation",
    dump.tables.attestations,
    [
      "id",
      "code",
      "issuedAt",
      "type",
      "fullName",
      "email",
      "birthDate",
      "birthPlace",
      "formationId",
      "startDate",
      "endDate",
      "location",
      "instructor",
      "issuingCompany",
      "status",
      "pdfUrl",
      "certificationHours",
      "certificationMention",
      "certificationObservations",
      "certificationScore",
      "gender",
      "stageHours",
      "stageObservations",
      "stageScore",
      "userId",
    ],
  ],
  [
    "CorrectionRequest",
    dump.tables.correctionRequests,
    [
      "id",
      "userId",
      "attestationId",
      "field",
      "oldValue",
      "newValue",
      "reason",
      "status",
      "createdAt",
      "updatedAt",
    ],
  ],
  [
    "Exam",
    dump.tables.exams,
    [
      "id",
      "title",
      "description",
      "status",
      "totalPoints",
      "createdAt",
      "updatedAt",
      "formationId",
      "duration",
      "name",
      "part1Enabled",
      "part1Points",
      "part1Questions",
      "part2Enabled",
      "part2Points",
      "part2Questions",
      "part3Enabled",
      "part3Mode",
      "part3Points",
      "part3Subject",
      "passingScore",
      "randomizeQuestions",
      "showResults",
      "scheduledAt",
      "session",
      "type",
    ],
  ],
  [
    "ExamPart",
    dump.tables.examParts,
    [
      "id",
      "examId",
      "title",
      "type",
      "duration",
      "points",
      "order",
      "scenario",
    ],
  ],
  [
    "Question",
    dump.tables.questions,
    ["id", "partId", "text", "type", "points", "order"],
  ],
  [
    "QuestionOption",
    dump.tables.questionOptions,
    ["id", "questionId", "text", "isCorrect", "feedback"],
  ],
  [
    "ExamSession",
    dump.tables.examSessions,
    [
      "id",
      "examId",
      "userId",
      "status",
      "scorePart1",
      "scorePart2",
      "scorePart3",
      "score",
      "totalScore",
      "internshipScore",
      "finalScore",
      "gradedBy",
      "gradedAt",
      "startedAt",
      "submittedAt",
      "updatedAt",
      "answers",
      "type",
      "transcriptDownloadedAt",
    ],
  ],
  [
    "CompositionScan",
    dump.tables.compositionScans,
    [
      "id",
      "submissionId",
      "url",
      "pageNumber",
      "fileName",
      "fileSize",
      "uploadedBy",
      "uploadedAt",
    ],
  ],
  [
    "Reclamation",
    dump.tables.reclamations,
    [
      "id",
      "userId",
      "submissionId",
      "subject",
      "message",
      "status",
      "adminReply",
      "createdAt",
      "updatedAt",
    ],
  ],
  [
    "InternshipRequest",
    dump.tables.internshipRequests,
    [
      "id",
      "fullName",
      "email",
      "phone",
      "university",
      "level",
      "position",
      "cvUrl",
      "message",
      "status",
      "createdAt",
      "updatedAt",
      "userId",
    ],
  ],
];

for (const [table, data, fields] of tables) {
  if (!data || data.length === 0) continue;
  console.log(`-- ${table}: ${data.length} rows`);
  console.log(`DELETE FROM "${table}";`);
  console.log(genInsert(table, data, fields));
}

console.log("\nSET session_replication_role = DEFAULT;");
console.log("-- Done");
