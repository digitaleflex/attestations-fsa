/**
 * Inventaire de référence et audit en lecture seule des attestations FSA (#255).
 *
 * Le script ne contient aucune opération Prisma d'écriture. Les codes FSA ne
 * sont jamais régénérés ni modifiés. Les rapports n'incluent ni noms, ni emails,
 * ni adresses de naissance : les enregistrements sont identifiés par empreinte.
 *
 * Usage :
 *   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
 *     scripts/check-data-integrity.ts --dry-run --report reports/fsa-reference.json
 *
 * Le premier rapport peut être enregistré comme référence. Les exécutions
 * suivantes comparent automatiquement le fichier passé par --baseline.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { isCorrected, resolveExamMax } from "../lib/exams/scoring";
import { PURPOSE_PREFIX, STORAGE_PURPOSES, looksLikeSignedUrl } from "../lib/storage/keys";

const ALLOWED_KEY_PREFIXES = new Set(STORAGE_PURPOSES.map((purpose) => PURPOSE_PREFIX[purpose]));
const PURPOSE_PREFIX_BY_PURPOSE: Record<string, string> = { ...PURPOSE_PREFIX };

export const FSA_CODE_RE = /^FSA-(\d{4})-M(\d{2})-(\d{5})-([0-9a-f]{5})$/;
const EPS = 0.009;

export type Severity = "CRITICAL" | "WARNING";
export interface Finding {
  severity: Severity;
  check: string;
  entity: string;
  detail: string;
}

export interface AttestationRow {
  id: string;
  code: string;
  userId: string | null;
  formationId: string;
  sessionId: string | null;
  status: string;
  type: string;
  fullName: string;
  email: string | null;
  birthDate: Date;
  birthPlace: string;
  startDate: Date;
  endDate: Date;
  issuedAt: Date;
  location: string;
  instructor: string;
  issuingCompany: string;
  pdfUrl: string | null;
  pdfKey: string | null;
  pdfHash: string | null;
  pdfVersion: number | null;
  pdfGeneratedAt: Date | null;
  certificationScore: number | null;
  certificationMention: string | null;
  certificationHours: number | null;
  sealHash: string | null;
  sealedAt: Date | null;
  sealVersion: number | null;
}

export interface SessionRow {
  id: string;
  userId: string;
  examId: string;
  status: string;
  scorePart1: number;
  scorePart2: number | null;
  scorePart3: number | null;
  totalScore: number;
  finalScore: number;
  internshipScore: number;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
}

export interface ExamRow {
  id: string;
  formationId: string | null;
  status: string;
  part1Points: number;
  part2Points: number;
  part3Points: number;
  part1Enabled: boolean;
  part2Enabled: boolean;
  part3Enabled: boolean;
  totalPoints: number;
}

export interface StoredObjectRow {
  id: string;
  key: string;
  ownerUserId: string | null;
  purpose: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  checksum: string;
  retentionUntil: Date | null;
}

export interface InternshipRow {
  id: string;
  userId: string | null;
  cvUrl: string | null;
  cvKey: string | null;
}

export interface IntegritySnapshot {
  attestations: AttestationRow[];
  sessions: SessionRow[];
  exams: ExamRow[];
  storedObjects: StoredObjectRow[];
  internshipRequests: InternshipRow[];
  userIds: Set<string>;
  formationIds: Set<string>;
  pdfKeyColumnPresent: boolean;
  storedObjectTablePresent: boolean;
}

export interface IntegrityReport {
  schemaVersion: 1;
  generatedAt: string;
  mode: "dry-run";
  readOnlyDatabase: true;
  summary: {
    attestations: number;
    uniqueCodes: number;
    sessions: number;
    exams: number;
    critical: number;
    warnings: number;
  };
  distributions: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byCodeYear: Record<string, number>;
    sessionsByStatus: Record<string, number>;
  };
  inventory: {
    attestations: Array<Record<string, unknown>>;
    sessions: Array<Record<string, unknown>>;
  };
  findings: Finding[];
}

export interface CliOptions {
  dryRun: true;
  readOnly: true;
  reportPath: string;
  baselinePath: string | null;
}

const SENSITIVE_KEYS = new Set([
  "code", "id", "userId", "formationId", "sessionId", "examId", "fullName", "name", "email",
  "birthDate", "birthPlace", "pdfUrl", "pdfKey",
]);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ref = (kind: string, value: string) => `${kind}#${hash(value).slice(0, 16)}`;
const countBy = (values: string[]) =>
  values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

export function parseArgs(argv: string[]): CliOptions {
  let reportPath = "reports/fsa-reference.json";
  let baselinePath: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "--read-only") continue;
    if (arg === "--report" || arg === "--baseline") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${arg}`);
      if (arg === "--report") reportPath = value;
      else baselinePath = value;
      continue;
    }
    throw new Error(`Option inconnue: ${arg}`);
  }
  return { dryRun: true, readOnly: true, reportPath, baselinePath };
}

/** Analyse pure : aucune connexion DB et aucun accès aux secrets dans le rapport. */
export function analyzeSnapshot(snapshot: IntegritySnapshot, now = new Date()): IntegrityReport {
  const findings: Finding[] = [];
  const add = (severity: Severity, check: string, entity: string, detail: string) =>
    findings.push({ severity, check, entity, detail });

  const sessions = new Map(snapshot.sessions.map((session) => [session.id, session]));
  const exams = new Map(snapshot.exams.map((exam) => [exam.id, exam]));
  const seenCodes = new Map<string, string>();
  const seenSequences = new Map<string, string>();
  const seenSessions = new Map<string, string>();
  const attestations: IntegrityReport["inventory"]["attestations"] = [];

  for (const attestation of snapshot.attestations) {
    const entity = ref("attestation", attestation.id);
    const codeMatch = FSA_CODE_RE.exec(attestation.code);
    if (!codeMatch) {
      add("CRITICAL", "FSA.code.format", entity, "code absent ou non conforme au format FSA");
    } else {
      const year = Number(codeMatch[1]);
      const month = Number(codeMatch[2]);
      const sequence = Number(codeMatch[3]);
      if (month < 1 || month > 12) add("CRITICAL", "FSA.code.month", entity, "mois de code hors 01..12");
      if (year < 2000 || year > now.getUTCFullYear() + 1) add("WARNING", "FSA.code.year", entity, "année de code inattendue");
      if (sequence < 1) add("CRITICAL", "FSA.code.sequence", entity, "séquence de code invalide");
      const sequenceKey = `${year}-${month}-${sequence}`;
      const duplicateSequence = seenSequences.get(sequenceKey);
      if (duplicateSequence) add("CRITICAL", "FSA.code.sequence.unique", entity, `séquence mensuelle réutilisée avec ${ref("attestation", duplicateSequence)}`);
      else seenSequences.set(sequenceKey, attestation.id);
    }

    const duplicateId = seenCodes.get(attestation.code);
    if (duplicateId) add("CRITICAL", "FSA.code.unique", entity, `code dupliqué avec ${ref("attestation", duplicateId)}`);
    else seenCodes.set(attestation.code, attestation.id);

    if (attestation.userId && !snapshot.userIds.has(attestation.userId)) add("CRITICAL", "FSA.user.link", entity, "utilisateur lié absent");
    if (!snapshot.formationIds.has(attestation.formationId)) add("CRITICAL", "FSA.formation.link", entity, "formation liée absente");
    if (!attestation.userId) add("WARNING", "FSA.user.link", entity, "attestation non rattachée à un utilisateur");
    if (attestation.type === "CERTIFICATION" && !attestation.sessionId) add("CRITICAL", "FSA.sessionId.required", entity, "sessionId manquant sur une certification");
    else if (attestation.sessionId) {
      const session = sessions.get(attestation.sessionId);
      if (!session) add("CRITICAL", "FSA.session.link", entity, "session liée absente");
      else {
        if (session.userId !== attestation.userId) add("CRITICAL", "FSA.session.candidate", entity, "session liée à un autre utilisateur");
        const exam = exams.get(session.examId);
        if (exam?.formationId && exam.formationId !== attestation.formationId) add("CRITICAL", "FSA.session.formation", entity, "formation de session différente");
        if (!session.submittedAt) add("CRITICAL", "FSA.session.submitted", entity, "session liée non soumise");
        if (attestation.status === "VALIDATED" && session.status !== "GRADED") add("CRITICAL", "FSA.status.certification", entity, "certificat validé sur session non corrigée");
        if (attestation.certificationScore != null && session.finalScore < attestation.certificationScore - EPS) add("WARNING", "FSA.certification.score", entity, "score de session inférieur au score certifié");
        const duplicateSession = seenSessions.get(attestation.sessionId);
        if (duplicateSession) add("CRITICAL", "FSA.session.unique", entity, `session déjà liée à ${ref("attestation", duplicateSession)}`);
        else seenSessions.set(attestation.sessionId, attestation.id);
      }
    }

    if (attestation.startDate > attestation.endDate) add("CRITICAL", "FSA.dates.range", entity, "date de début postérieure à la date de fin");
    if (attestation.endDate > attestation.issuedAt) add("CRITICAL", "FSA.dates.issued", entity, "émission antérieure à la fin de la période");
    if (attestation.birthDate > attestation.startDate) add("CRITICAL", "FSA.dates.birth", entity, "date de naissance postérieure au début");
    if (attestation.status === "VALIDATED") {
      if (attestation.type === "CERTIFICATION" && (attestation.certificationScore == null || !attestation.certificationMention)) add("CRITICAL", "FSA.proof.certification", entity, "preuve de certification incomplète");
      if (!attestation.sealHash || !attestation.sealedAt) add("WARNING", "FSA.proof.seal", entity, "sceau probant absent");
      else if (!/^[0-9a-f]{64}$/.test(attestation.sealHash)) add("CRITICAL", "FSA.proof.seal", entity, "empreinte de sceau non conforme");
    }
    if (attestation.status === "REJECTED" && (attestation.certificationScore ?? 0) > 0) add("WARNING", "FSA.status.rejected", entity, "attestation rejetée porteuse d'un score positif");
    if (attestation.pdfUrl && /(?:X-Amz-|Signature=|token=)/i.test(attestation.pdfUrl)) add("CRITICAL", "FSA.pdf.signed-persisted", entity, "une URL signée ne doit jamais être persistée");
    if (attestation.pdfKey && (!attestation.pdfHash || !attestation.pdfVersion || !attestation.pdfGeneratedAt)) add("CRITICAL", "FSA.pdf.proof", entity, "pdfKey sans hash, version et date de génération");
    if (attestation.certificationScore != null && (attestation.certificationScore < 0 || attestation.certificationScore > 100)) add("CRITICAL", "FSA.proof.score", entity, "score de certification hors 0..100");
    if (attestation.certificationHours != null && attestation.certificationHours < 0) add("CRITICAL", "FSA.proof.hours", entity, "volume horaire négatif");

    const proofFields: unknown[] = [attestation.fullName, attestation.birthPlace, attestation.location, attestation.instructor, attestation.issuingCompany];
    if (proofFields.some((value) => typeof value !== "string" || value.trim().length === 0)) add("CRITICAL", "FSA.proof.fields", entity, "champ probant obligatoire vide");
    attestations.push({
      recordIdHash: hash(attestation.id),
      codeHash: hash(attestation.code),
      year: codeMatch ? codeMatch[1] : null,
      month: codeMatch ? codeMatch[2] : null,
      sequence: codeMatch ? codeMatch[3] : null,
      status: attestation.status,
      type: attestation.type,
      hasUser: Boolean(attestation.userId),
      hasFormation: snapshot.formationIds.has(attestation.formationId),
      hasSession: Boolean(attestation.sessionId),
      hasPdf: Boolean(attestation.pdfKey || attestation.pdfUrl),
      hasPdfKey: Boolean(attestation.pdfKey),
      hasSeal: Boolean(attestation.sealHash && attestation.sealedAt),
      proofComplete: proofFields.every(Boolean) && (attestation.type !== "CERTIFICATION" || attestation.status !== "VALIDATED" || Boolean(attestation.certificationScore != null && attestation.certificationMention)),
    });
  }

  const sessionSeen = new Map<string, string>();
  for (const session of snapshot.sessions) {
    const entity = ref("session", session.id);
    if (!snapshot.userIds.has(session.userId)) add("CRITICAL", "FSA.session.user", entity, "utilisateur de session absent");
    if (!exams.has(session.examId)) add("CRITICAL", "FSA.session.exam", entity, "examen de session absent");
    const duplicate = sessionSeen.get(`${session.userId}::${session.examId}`);
    if (duplicate) add("CRITICAL", "FSA.session.unique", entity, `doublon avec ${ref("session", duplicate)}`);
    else sessionSeen.set(`${session.userId}::${session.examId}`, session.id);
    if (session.finalScore < -EPS || session.finalScore > 100 + EPS) add("CRITICAL", "FSA.session.finalScore", entity, "score final hors 0..100");
    if (isCorrected(session.status) && Math.abs(session.scorePart1 + (session.scorePart2 ?? 0) + (session.scorePart3 ?? 0) - session.totalScore) > EPS) add("WARNING", "FSA.session.totalScore", entity, "total différent de la somme des parties");
    if (session.status === "GRADED" && session.scorePart2 == null) add("CRITICAL", "FSA.session.graded", entity, "session GRADED avec partie 2 non corrigée");
    if (
      ["IN_PROGRESS", "PENDING"].includes(session.status) &&
      session.submittedAt
    ) add("CRITICAL", "FSA.session.transition", entity, "statut actif avec submittedAt présent");
    if (
      isCorrected(session.status) &&
      !session.submittedAt
    ) add("CRITICAL", "FSA.session.submission", entity, "session corrigée sans submittedAt");
    if (session.startedAt > (session.submittedAt ?? session.startedAt)) add("CRITICAL", "FSA.session.dates", entity, "début de session postérieur à la soumission");
    if (session.gradedAt && !isCorrected(session.status)) add("WARNING", "FSA.session.gradedAt", entity, "date de correction présente sur session non corrigée");
  }

  for (const exam of snapshot.exams) {
    if (exam.formationId && !snapshot.formationIds.has(exam.formationId)) add("CRITICAL", "FSA.exam.formation", ref("exam", exam.id), "formation d’examen absente");
    const max = resolveExamMax(exam);
    if (max <= 0) add("CRITICAL", "FSA.exam.max", ref("exam", exam.id), "barème total non positif");
    const parts: Array<[boolean, number, string]> = [
      [exam.part1Enabled, exam.part1Points, "partie 1"],
      [exam.part2Enabled, exam.part2Points, "partie 2"],
      [exam.part3Enabled, exam.part3Points, "partie 3"],
    ];
    for (const [enabled, points, label] of parts) {
      if (enabled && points < 0) add("CRITICAL", "FSA.exam.points", ref("exam", exam.id), `${label} avec barème négatif`);
    }
  }

  if (!snapshot.pdfKeyColumnPresent) add("WARNING", "FSA.pdf.schema", "schema", "colonne pdfKey absente du modèle courant");

  // #260 — Registre des objets stockés (bucket privé).
  const storedKeys = new Set<string>();
  for (const object of snapshot.storedObjects) {
    const entity = ref("storedObject", object.id);
    const prefix = object.key.split("/")[0];
    if (!ALLOWED_KEY_PREFIXES.has(prefix)) {
      add("CRITICAL", "STORAGE.key.prefix", entity, "clé hors des préfixes autorisés cv/ stages/ attestations/ exports/ temporary/");
    }
    if (looksLikeSignedUrl(object.key)) add("CRITICAL", "STORAGE.key.signed", entity, "une URL signée ne doit jamais être persistée");
    if (storedKeys.has(object.key)) add("CRITICAL", "STORAGE.key.duplicate", entity, "clé déjà enregistrée");
    else storedKeys.add(object.key);
    if (!/^[0-9a-f]{64}$/.test(object.checksum)) add("CRITICAL", "STORAGE.checksum.format", entity, "empreinte SHA-256 absente ou non conforme");
    if (object.ownerUserId && !snapshot.userIds.has(object.ownerUserId)) add("WARNING", "STORAGE.owner.link", entity, "propriétaire absent de la base");
    if (object.purpose === "attestation" && !object.linkedEntityId) add("CRITICAL", "STORAGE.official.link", entity, "PDF officiel sans entité liée");
    if (!ALLOWED_KEY_PREFIXES.has(prefix) && object.purpose !== "attestation" && prefix !== PURPOSE_PREFIX_BY_PURPOSE[object.purpose]) {
      add("WARNING", "STORAGE.purpose.prefix", entity, "préfixe incohérent avec l’usage déclaré");
    }
  }

  for (const request of snapshot.internshipRequests) {
    const entity = ref("internship", request.id);
    if (request.cvUrl && looksLikeSignedUrl(request.cvUrl)) {
      add("CRITICAL", "STORAGE.internship.signed-persisted", entity, "une URL signée ne doit jamais être persistée");
    }
    if (request.cvKey && !storedKeys.has(request.cvKey)) {
      add("WARNING", "STORAGE.internship.key.unregistered", entity, "cvKey absent du registre des objets");
    }
    if (request.userId && !snapshot.userIds.has(request.userId)) add("CRITICAL", "STORAGE.internship.user", entity, "utilisateur lié absent");
  }

  if (!snapshot.storedObjectTablePresent) add("WARNING", "STORAGE.schema", "schema", "table StoredObject absente du modèle courant");

  const critical = findings.filter((finding) => finding.severity === "CRITICAL").length;
  const warnings = findings.length - critical;
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    mode: "dry-run",
    readOnlyDatabase: true,
    summary: { attestations: snapshot.attestations.length, uniqueCodes: seenCodes.size, sessions: snapshot.sessions.length, exams: snapshot.exams.length, critical, warnings },
    distributions: {
      byStatus: countBy(snapshot.attestations.map((row) => row.status)),
      byType: countBy(snapshot.attestations.map((row) => row.type)),
      byCodeYear: countBy(snapshot.attestations.flatMap((row) => FSA_CODE_RE.exec(row.code) ? [FSA_CODE_RE.exec(row.code)![1]] : [])),
      sessionsByStatus: countBy(snapshot.sessions.map((row) => row.status)),
    },
    inventory: {
      attestations: attestations.sort((a, b) => String(a.recordIdHash).localeCompare(String(b.recordIdHash))),
      sessions: snapshot.sessions.map((session) => ({
        recordIdHash: hash(session.id),
        status: session.status,
        hasUser: snapshot.userIds.has(session.userId),
        hasExam: exams.has(session.examId),
        hasCertificate: [...seenSessions.keys()].includes(session.id),
        hasSubmittedAt: Boolean(session.submittedAt),
        hasGradedAt: Boolean(session.gradedAt),
      })).sort((a, b) => String(a.recordIdHash).localeCompare(String(b.recordIdHash))),
    },
    findings,
  };
}

export function compareWithBaseline(report: IntegrityReport, baseline: IntegrityReport): Finding[] {
  if (baseline.schemaVersion !== 1) throw new Error("Version de rapport de référence non prise en charge");
  const findings: Finding[] = [];
  for (const kind of ["attestations", "sessions"] as const) {
    const oldRows = baseline.inventory[kind] as Array<Record<string, unknown>>;
    const currentRows = report.inventory[kind] as Array<Record<string, unknown>>;
    const oldById = new Map(oldRows.map((row) => [String(row.recordIdHash), row]));
    const currentIds = new Set(currentRows.map((row) => String(row.recordIdHash)));
    for (const row of currentRows) {
      const id = String(row.recordIdHash);
      const entity = `${kind}#${id.slice(0, 16)}`;
      if (!oldById.has(id)) {
        findings.push({ severity: "WARNING", check: "REFERENCE.added", entity, detail: "enregistrement absent de l’inventaire de référence" });
        continue;
      }
      const old = oldById.get(id)!;
      // Seul le code d'un certificat existant est figé. Ses statuts et preuves
      // peuvent évoluer selon le cycle métier, tout en restant inventoriés.
      if (kind === "attestations" && row.codeHash !== old.codeHash) {
        findings.push({ severity: "CRITICAL", check: "REFERENCE.code.changed", entity, detail: "code FSA différent de l’inventaire de référence" });
      }
    }
    for (const old of oldRows) {
      if (!currentIds.has(String(old.recordIdHash))) findings.push({
        severity: kind === "attestations" ? "CRITICAL" : "WARNING",
        check: "REFERENCE.removed",
        entity: `${kind}#${String(old.recordIdHash).slice(0, 16)}`,
        detail: "enregistrement de référence absent de l’inventaire courant",
      });
    }
  }
  return findings;
}

export function redactReport(report: IntegrityReport): IntegrityReport {
  const serialized = JSON.stringify(report);
  for (const key of SENSITIVE_KEYS) {
    if (new RegExp(`\\"${key}\\":`).test(serialized)) throw new Error(`Champ potentiellement sensible dans le rapport: ${key}`);
  }
  return report;
}

const quoteIdentifier = (identifier: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error("Identifiant SQL non autorisé");
  return Prisma.raw(`"${identifier}"`);
};

async function tableColumns(prisma: PrismaClient, table: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error("Table SQL non autorisée");
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}
  `);
  return rows.map((row) => row.column_name);
}

async function selectRows<T>(prisma: PrismaClient, table: string, wanted: string[], columns: string[]) {
  const available = new Set(columns);
  // Table absente (base antérieure à une migration) : rien à auditer.
  if (available.size === 0) return [] as T[];
  const selected = wanted.filter((column) => available.has(column));
  if (!selected.includes("id")) throw new Error(`Colonne id absente de ${table}`);
  const projection = Prisma.join(selected.map(quoteIdentifier));
  return prisma.$queryRaw<T[]>(Prisma.sql`
    SELECT ${projection} FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier("id")} ASC
  `);
}

async function loadSnapshot(prisma: PrismaClient): Promise<IntegritySnapshot> {
  // L'inventaire reste lisible sur une base antérieure à une migration : seules
  // les colonnes réellement présentes sont sélectionnées. Les noms viennent
  // d'une liste blanche et les valeurs restent paramétrées par Prisma.sql.
  const [attestationColumns, sessionColumns, examColumns, storedObjectColumns, internshipColumns] =
    await Promise.all([
      tableColumns(prisma, "Attestation"),
      tableColumns(prisma, "ExamSession"),
      tableColumns(prisma, "Exam"),
      tableColumns(prisma, "StoredObject"),
      tableColumns(prisma, "InternshipRequest"),
    ]);
  const [attestationRows, sessionRows, examRows, storedObjectRows, internshipRows, users, formations] =
    await Promise.all([
    selectRows<AttestationRow>(prisma, "Attestation", [
      "id", "code", "userId", "formationId", "sessionId", "status", "type", "fullName", "email",
      "birthDate", "birthPlace", "startDate", "endDate", "issuedAt", "location", "instructor",
      "issuingCompany", "pdfUrl", "pdfKey", "pdfHash", "pdfVersion", "pdfGeneratedAt",
      "certificationScore", "certificationMention", "certificationHours", "sealHash", "sealedAt", "sealVersion",
    ], attestationColumns),
    selectRows<SessionRow>(prisma, "ExamSession", [
      "id", "userId", "examId", "status", "scorePart1", "scorePart2", "scorePart3", "totalScore",
      "finalScore", "internshipScore", "startedAt", "submittedAt", "gradedAt",
    ], sessionColumns),
    selectRows<ExamRow>(prisma, "Exam", [
      "id", "formationId", "status", "part1Points", "part2Points", "part1Enabled",
      "part2Enabled", "part3Enabled", "totalPoints",
    ], examColumns),
    selectRows<StoredObjectRow>(prisma, "StoredObject", [
      "id", "key", "ownerUserId", "purpose", "linkedEntityType", "linkedEntityId", "checksum",
      "retentionUntil",
    ], storedObjectColumns),
    selectRows<InternshipRow>(prisma, "InternshipRequest", [
      "id", "userId", "cvUrl", "cvKey",
    ], internshipColumns),
    prisma.user.findMany({ select: { id: true } }),
    prisma.formation.findMany({ select: { id: true } }),
  ]);
  const defaults: Record<string, unknown> = {
    userId: null, sessionId: null, email: null, pdfUrl: null, pdfKey: null,
    pdfHash: null, pdfVersion: null, pdfGeneratedAt: null,
    certificationScore: null, certificationMention: null, certificationHours: null,
    sealHash: null, sealedAt: null, sealVersion: null,
  };
  const attestations = attestationRows.map((row) => ({ ...defaults, ...row })) as AttestationRow[];
  return {
    attestations,
    sessions: sessionRows,
    exams: examRows,
    storedObjects: storedObjectRows,
    internshipRequests: internshipRows,
    userIds: new Set(users.map((row) => row.id)),
    formationIds: new Set(formations.map((row) => row.id)),
    pdfKeyColumnPresent: attestationColumns.includes("pdfKey"),
    storedObjectTablePresent: storedObjectColumns.includes("key"),
  };
}

async function writeReport(path: string, report: IntegrityReport) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(redactReport(report), null, 2)}\n`, { encoding: "utf8", flag: "w" });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const prisma = new PrismaClient();
  try {
    const report = analyzeSnapshot(await loadSnapshot(prisma));
    if (options.baselinePath) {
      const baseline = JSON.parse(await readFile(resolve(options.baselinePath), "utf8")) as IntegrityReport;
      report.findings.push(...compareWithBaseline(report, baseline));
      report.summary.critical = report.findings.filter((finding) => finding.severity === "CRITICAL").length;
      report.summary.warnings = report.findings.filter((finding) => finding.severity === "WARNING").length;
    }
    await writeReport(options.reportPath, report);
    console.log(`Rapport JSON sans PII écrit dans ${options.reportPath}`);
    console.log(`${report.summary.attestations} attestations, ${report.summary.uniqueCodes} codes uniques, ${report.summary.critical} critique(s), ${report.summary.warnings} avertissement(s)`);
    return report.summary.critical > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = process.argv[1]?.endsWith("check-data-integrity.ts");
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error("[CHECK_INTEGRITY_ERROR]", error instanceof Error ? error.message : "erreur inconnue");
    process.exitCode = 1;
  });
}
