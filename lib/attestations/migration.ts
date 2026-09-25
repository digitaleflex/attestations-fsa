/**
 * Classification et plan de migration des attestations historiques FSA (#259).
 *
 * Principes non négociables :
 *  - la fonction est PURE : aucun accès base, aucun secret, aucune écriture ;
 *  - le module ne génère aucun PDF et ne rescelle aucune ligne historique ;
 *  - les codes FSA ne sont jamais modifiés, supprimés ni renumérotés — le
 *    module ne propose d'ailleurs aucun champ `code` en écriture ;
 *  - toute correspondance de `sessionId` est une PROPOSITION : une
 *    correspondance ambiguë n'est jamais automatisée.
 *
 * Le plan produit est un rapport JSON sans PII (empreintes tronquées).
 */
import { createHash } from "node:crypto";
// Import relatif : ce module est exécuté par ts-node (scripts/), qui ne résout pas
// les alias "@/".
import { isCorrected } from "../exams/scoring";

/** Format du code FSA, aligné sur `scripts/check-data-integrity.ts` (#255). */
export const FSA_CODE_PATTERN = /^FSA-(\d{4})-M(\d{2})-(\d{5})-([0-9a-f]{5})$/;

const EPS = 0.009;
/** Tolérance (jours) autour de la période de formation pour candidater une session. */
const SESSION_WINDOW_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Les six statuts demandés par #259, plus `NO_ACTION_REQUIRED` : une ligne déjà
 * scellée en v2 avec une preuve complète n'a rien à migrer. Le nommer
 * `SEALABLE_WITH_EVIDENCE` serait faux et surchargerait l'inventaire.
 */
export const MIGRATION_STATUSES = [
  "MIGRATION_BLOCKED",
  "REVOKED",
  "REISSUE",
  "REQUIRES_REVIEW",
  "SEALABLE_WITH_EVIDENCE",
  "LEGACY_UNSEALED",
  "NO_ACTION_REQUIRED",
] as const;
export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

export const MIGRATION_STATUS_LABELS: Record<MigrationStatus, string> = {
  MIGRATION_BLOCKED: "Anomalie bloquante : aucune migration possible sans décision métier",
  REVOKED: "Certificat rejeté : ligne figée, publication désactivée",
  REISSUE: "Document officiel inexploitable : réémission nécessaire (nouveau code)",
  REQUIRES_REVIEW: "Décision métier humaine requise (lien de session ambigu notamment)",
  SEALABLE_WITH_EVIDENCE: "Preuve complète : scellement v2 possible APRÈS validation métier",
  LEGACY_UNSEALED: "Ligne historique antérieure au scellement : laissée intacte",
  NO_ACTION_REQUIRED: "Déjà conforme au modèle courant : aucune action",
};

export const SESSION_MATCH_KINDS = [
  "ALREADY_LINKED",
  "UNIQUE_CANDIDATE",
  "AMBIGUOUS",
  "NONE",
  "NOT_APPLICABLE",
] as const;
export type SessionMatchKind = (typeof SESSION_MATCH_KINDS)[number];

export interface MigrationAttestationRow {
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

export interface MigrationSessionRow {
  id: string;
  userId: string;
  examId: string;
  status: string;
  finalScore: number;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
}

export interface MigrationExamRow {
  id: string;
  formationId: string | null;
}

export interface MigrationSnapshot {
  attestations: MigrationAttestationRow[];
  sessions: MigrationSessionRow[];
  exams: MigrationExamRow[];
  userIds: Set<string>;
  formationIds: Set<string>;
}

export interface SessionMatch {
  kind: SessionMatchKind;
  candidateCount: number;
  /** Empreintes tronquées des sessions candidates — jamais d'identifiant brut. */
  candidateRefs: string[];
  /** Toujours vrai : un lien proposé n'est jamais écrit automatiquement. */
  autoLink: false;
}

export type SealState = "UNSEALED" | "LEGACY_V1" | "SEALED_V2" | "MALFORMED";

export interface MigrationEvidence {
  hasUser: boolean;
  hasSession: boolean;
  hasPdfProof: boolean;
  hasSeal: boolean;
  sealState: SealState;
  pdfVersion: number | null;
  proofComplete: boolean;
  scoreDeltaBucket: "none" | "close" | "gap";
}

export interface MigrationRecord {
  recordIdHash: string;
  codeHash: string;
  year: string | null;
  month: string | null;
  sequence: string | null;
  type: string;
  currentStatus: string;
  migrationStatus: MigrationStatus;
  sessionMatch: SessionMatch;
  evidence: MigrationEvidence;
  /** Codes d'anomalie bloquante, triés et sans valeur métier sensible. */
  blockers: string[];
  /** Actions PROPOSÉES. Aucune n'est exécutée par cet outil. */
  proposedActions: string[];
  requiresBusinessApproval: true;
  rationale: string;
}

export interface MigrationReport {
  schemaVersion: 1;
  generatedAt: string;
  mode: "dry-run";
  readOnlyDatabase: true;
  applyRefused: true;
  writesPerformed: 0;
  generatedPdf: 0;
  resealedRows: 0;
  summary: {
    attestations: number;
    byMigrationStatus: Record<string, number>;
    blockingAnomalies: number;
    sessionMatches: Record<string, number>;
    reviewRequired: number;
  };
  distributions: {
    byCurrentStatus: Record<string, number>;
    byType: Record<string, number>;
    byCodeYear: Record<string, number>;
    bySealState: Record<string, number>;
  };
  records: MigrationRecord[];
  legend: Record<MigrationStatus, string>;
  /** Anomalies agrégées, sans PII. */
  findings: Array<{ severity: "CRITICAL" | "WARNING"; check: string; entity: string; detail: string }>;
}

const SENSITIVE_KEYS = new Set([
  "code", "id", "userId", "formationId", "sessionId", "examId", "fullName", "name", "email",
  "birthDate", "birthPlace", "pdfUrl", "pdfKey", "pdfHash",
]);
const PROOF_FIELDS = ["fullName", "birthPlace", "location", "instructor", "issuingCompany"] as const;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ref = (kind: string, value: string) => `${kind}#${hash(value).slice(0, 16)}`;
const countBy = (values: string[]) =>
  values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

function sealStateOf(row: MigrationAttestationRow): SealState {
  if (!row.sealHash || !row.sealedAt) return "UNSEALED";
  if (!/^[0-9a-f]{64}$/.test(row.sealHash)) return "MALFORMED";
  if ((row.sealVersion ?? 1) >= 2) return "SEALED_V2";
  return "LEGACY_V1";
}

function proofComplete(row: MigrationAttestationRow): boolean {
  const fieldsOk = PROOF_FIELDS.every((field) => typeof row[field] === "string" && row[field].trim().length > 0);
  if (!fieldsOk) return false;
  if (row.type === "CERTIFICATION") {
    return row.certificationScore != null && Boolean(row.certificationMention);
  }
  return true;
}

/**
 * Candidature de session : même candidat, même formation, session corrigée et
 * soumise, dans une fenêtre de tolérance autour de la période de formation.
 * Une seule candidate reste une PROPOSITION, jamais une correspondance.
 */
function sessionCandidates(
  row: MigrationAttestationRow,
  sessions: Map<string, MigrationSessionRow>,
  exams: Map<string, MigrationExamRow>,
  linkedSessionIds: Set<string>,
): MigrationSessionRow[] {
  if (!row.userId) return [];
  const lower = row.startDate.getTime() - SESSION_WINDOW_DAYS * DAY_MS;
  const upper = row.endDate.getTime() + SESSION_WINDOW_DAYS * DAY_MS;
  return [...sessions.values()].filter((session) => {
    if (session.userId !== row.userId) return false;
    if (linkedSessionIds.has(session.id)) return false;
    if (!isCorrected(session.status) || !session.submittedAt) return false;
    const exam = exams.get(session.examId);
    if (exam?.formationId && exam.formationId !== row.formationId) return false;
    const submitted = session.submittedAt.getTime();
    return submitted >= lower && submitted <= upper;
  });
}

function matchKind(
  row: MigrationAttestationRow,
  candidates: MigrationSessionRow[],
): SessionMatchKind {
  if (row.sessionId) return "ALREADY_LINKED";
  if (row.type !== "CERTIFICATION") return "NOT_APPLICABLE";
  if (candidates.length === 0) return "NONE";
  return candidates.length === 1 ? "UNIQUE_CANDIDATE" : "AMBIGUOUS";
}

/** Analyse pure — aucun accès base, aucun secret, aucune écriture. */
export function classifySnapshot(snapshot: MigrationSnapshot, now = new Date()): MigrationReport {
  const sessions = new Map(snapshot.sessions.map((session) => [session.id, session]));
  const exams = new Map(snapshot.exams.map((exam) => [exam.id, exam]));
  const linkedSessionIds = new Set(
    snapshot.attestations.map((row) => row.sessionId).filter((value): value is string => Boolean(value)),
  );
  const findings: MigrationReport["findings"] = [];
  const records: MigrationRecord[] = [];
  const seenSequences = new Map<string, string>();
  const seenCodes = new Set<string>();
  let blockingAnomalies = 0;

  for (const row of [...snapshot.attestations].sort((a, b) => a.id.localeCompare(b.id))) {
    const entity = ref("attestation", row.id);
    const codeMatch = FSA_CODE_PATTERN.exec(row.code);
    const blockers = new Set<string>();
    const sealState = sealStateOf(row);
    const addBlocker = (code: string) => blockers.add(code);

    // --- Codes FSA : figés. Une anomalie de numérotation est bloquante, elle
    // ne se corrige jamais ici (aucun renumérotage n'est possible).
    if (!codeMatch) addBlocker("CODE_FORMAT_INVALID");
    if (seenCodes.has(row.code)) addBlocker("CODE_DUPLICATE");
    else seenCodes.add(row.code);
    if (codeMatch) {
      const sequenceKey = `${codeMatch[1]}-${codeMatch[2]}-${codeMatch[3]}`;
      if (seenSequences.has(sequenceKey)) addBlocker("CODE_SEQUENCE_REUSED");
      else seenSequences.set(sequenceKey, row.id);
    }

    // --- Liens
    if (row.userId && !snapshot.userIds.has(row.userId)) addBlocker("USER_LINK_BROKEN");
    if (!snapshot.formationIds.has(row.formationId)) addBlocker("FORMATION_LINK_BROKEN");

    // --- Période : l'inversion est une anomalie BLOQUANTE (#259). Corriger les
    // dates reviendrait à réécrire un document probant sans preuve.
    if (row.startDate.getTime() > row.endDate.getTime()) addBlocker("PERIOD_INVERTED");
    if (row.endDate.getTime() > row.issuedAt.getTime()) addBlocker("ISSUED_BEFORE_PERIOD_END");
    if (row.birthDate.getTime() > row.startDate.getTime()) addBlocker("BIRTH_AFTER_START");

    // --- Preuves
    if (row.certificationScore != null && (row.certificationScore < 0 || row.certificationScore > 100)) {
      addBlocker("CERTIFICATION_SCORE_OUT_OF_RANGE");
    }
    if (!proofComplete(row)) addBlocker("PROOF_INCOMPLETE");
    if (row.pdfKey && (!row.pdfHash || !row.pdfVersion || !row.pdfGeneratedAt)) {
      addBlocker("PDF_PROOF_INCOMPLETE");
    }
    if (sealState === "MALFORMED") addBlocker("SEAL_HASH_MALFORMED");

    // --- Session
    const candidates = sessionCandidates(row, sessions, exams, linkedSessionIds);
    const kind = matchKind(row, candidates);
    let evidenceSession: MigrationSessionRow | null = null;
    if (row.sessionId) {
      evidenceSession = sessions.get(row.sessionId) ?? null;
      if (!evidenceSession) addBlocker("SESSION_LINK_BROKEN");
    }
    if (row.type === "CERTIFICATION" && kind === "NONE") {
      addBlocker("CERTIFICATION_WITHOUT_SESSION");
    }

    let scoreBucket: MigrationEvidence["scoreDeltaBucket"] = "none";
    if (evidenceSession && row.certificationScore != null) {
      const delta = row.certificationScore - evidenceSession.finalScore;
      if (delta > EPS) {
        addBlocker("CERTIFIED_SCORE_ABOVE_SESSION");
        scoreBucket = "gap";
      } else if (Math.abs(delta) > EPS) {
        scoreBucket = "close";
      }
    }
    if (evidenceSession) {
      if (evidenceSession.userId !== row.userId) addBlocker("SESSION_OTHER_CANDIDATE");
      if (!evidenceSession.submittedAt) addBlocker("SESSION_NOT_SUBMITTED");
      if (!isCorrected(evidenceSession.status)) addBlocker("SESSION_NOT_GRADED");
      if (row.status === "VALIDATED" && evidenceSession.status !== "GRADED") {
        addBlocker("VALIDATED_ON_UNGRADED_SESSION");
      }
    }

    // --- Statut de migration (ordre de précédence strict, du plus bloquant au
    // plus neutre). Jamais de recouvrement.
    let migrationStatus: MigrationStatus;
    if (blockers.size > 0) migrationStatus = "MIGRATION_BLOCKED";
    else if (row.status === "REJECTED") migrationStatus = "REVOKED";
    else if (row.status === "PENDING") migrationStatus = "REQUIRES_REVIEW";
    else if (kind === "AMBIGUOUS") migrationStatus = "REQUIRES_REVIEW";
    else if (!proofComplete(row)) migrationStatus = "REQUIRES_REVIEW";
    else if (sealState === "UNSEALED" && !row.pdfKey) migrationStatus = "LEGACY_UNSEALED";
    else if (sealState === "UNSEALED" || sealState === "LEGACY_V1") {
      // Ni document officiel ni sceau v2 : le sceau actuel porterait sur des
      // données jamais imprimées. Il faut un document officiel probant, donc
      // une réémission — jamais un scellement d'une ligne historique.
      migrationStatus = row.pdfKey && row.pdfHash ? "SEALABLE_WITH_EVIDENCE" : "REISSUE";
    } else migrationStatus = "NO_ACTION_REQUIRED";

    const actions = proposedActions(migrationStatus, { sealState, kind, candidates });
    for (const blocker of blockers) {
      blockingAnomalies += 1;
      findings.push({ severity: "CRITICAL", check: `MIGRATION.${blocker}`, entity, detail: describeBlocker(blocker) });
    }
    if (kind === "AMBIGUOUS") {
      findings.push({ severity: "WARNING", check: "MIGRATION.session.ambiguous", entity, detail: `${candidates.length} sessions candidates — correspondance non automatisée` });
    }
    if (kind === "UNIQUE_CANDIDATE") {
      findings.push({ severity: "WARNING", check: "MIGRATION.session.candidate", entity, detail: "session candidate unique — rattachement proposé, non appliqué" });
    }

    records.push({
      recordIdHash: hash(row.id),
      codeHash: hash(row.code),
      year: codeMatch ? codeMatch[1] : null,
      month: codeMatch ? codeMatch[2] : null,
      sequence: codeMatch ? codeMatch[3] : null,
      type: row.type,
      currentStatus: row.status,
      migrationStatus,
      sessionMatch: {
        kind,
        candidateCount: candidates.length,
        candidateRefs: candidates.map((candidate) => ref("session", candidate.id)),
        autoLink: false,
      },
      evidence: {
        hasUser: Boolean(row.userId),
        hasSession: Boolean(evidenceSession) || kind === "UNIQUE_CANDIDATE",
        hasPdfProof: Boolean(row.pdfKey && row.pdfHash),
        hasSeal: sealState === "LEGACY_V1" || sealState === "SEALED_V2",
        sealState,
        pdfVersion: row.pdfVersion,
        proofComplete: proofComplete(row),
        scoreDeltaBucket: scoreBucket,
      },
      blockers: [...blockers].sort(),
      proposedActions: actions,
      requiresBusinessApproval: true,
      rationale: rationaleFor(migrationStatus, sealState, kind),
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    mode: "dry-run",
    readOnlyDatabase: true,
    applyRefused: true,
    writesPerformed: 0,
    generatedPdf: 0,
    resealedRows: 0,
    summary: {
      attestations: snapshot.attestations.length,
      byMigrationStatus: countBy(records.map((record) => record.migrationStatus)),
      blockingAnomalies,
      sessionMatches: countBy(records.map((record) => record.sessionMatch.kind)),
      reviewRequired: records.filter((record) => record.migrationStatus === "REQUIRES_REVIEW").length,
    },
    distributions: {
      byCurrentStatus: countBy(snapshot.attestations.map((row) => row.status)),
      byType: countBy(snapshot.attestations.map((row) => row.type)),
      byCodeYear: countBy(snapshot.attestations.flatMap((row) => (FSA_CODE_PATTERN.exec(row.code) ? [FSA_CODE_PATTERN.exec(row.code)![1]] : []))),
      bySealState: countBy(records.map((record) => record.evidence.sealState)),
    },
    records: records.sort((a, b) => a.recordIdHash.localeCompare(b.recordIdHash)),
    legend: MIGRATION_STATUS_LABELS,
    findings,
  };
}

function describeBlocker(code: string): string {
  const map: Record<string, string> = {
    CODE_FORMAT_INVALID: "code FSA absent ou non conforme — jamais renuméroté",
    CODE_DUPLICATE: "code FSA dupliqué",
    CODE_SEQUENCE_REUSED: "séquence mensuelle de code réutilisée",
    USER_LINK_BROKEN: "utilisateur lié absent",
    FORMATION_LINK_BROKEN: "formation liée absente",
    PERIOD_INVERTED: "période inversée : début postérieur à la fin",
    ISSUED_BEFORE_PERIOD_END: "émission antérieure à la fin de la période",
    BIRTH_AFTER_START: "date de naissance postérieure au début de la période",
    CERTIFICATION_SCORE_OUT_OF_RANGE: "score de certification hors 0..100",
    PROOF_INCOMPLETE: "champ probant obligatoire vide",
    PDF_PROOF_INCOMPLETE: "pdfKey sans hash, version et date de génération",
    SEAL_HASH_MALFORMED: "empreinte de sceau non conforme",
    SESSION_LINK_BROKEN: "session liée absente",
    SESSION_OTHER_CANDIDATE: "session liée à un autre candidat",
    SESSION_NOT_SUBMITTED: "session liée non soumise",
    SESSION_NOT_GRADED: "session liée non corrigée",
    VALIDATED_ON_UNGRADED_SESSION: "certificat validé sur session non corrigée",
    CERTIFICATION_WITHOUT_SESSION: "certification sans session rattachable",
    CERTIFIED_SCORE_ABOVE_SESSION: "score certifié supérieur au score de session",
  };
  return map[code] ?? code;
}

function proposedActions(
  status: MigrationStatus,
  context: { sealState: SealState; kind: SessionMatchKind; candidates: MigrationSessionRow[] },
): string[] {
  switch (status) {
    case "MIGRATION_BLOCKED":
      return ["AUCUNE_ACTION_AUTOMATIQUE", "DECISION_METIER_OBLIGATOIRE"];
    case "REVOKED":
      return ["FIGER_LIGNE", "NE_PUBLIER_AUCUN_DOCUMENT"];
    case "REISSUE":
      return ["REEMETTRE_DOCUMENT_OFFICIEL_AVEC_NOUVEAU_CODE"];
    case "REQUIRES_REVIEW":
      return context.kind === "AMBIGUOUS"
        ? ["RESOUDRE_CORRESPONDANCE_SESSION", "RATTACHER_SESSION_APRES_VALIDATION"]
        : ["REVIEW_METIER_OBLIGATOIRE"];
    case "SEALABLE_WITH_EVIDENCE":
      return [
        ...(context.kind === "UNIQUE_CANDIDATE" ? ["RATTACHER_SESSION_APRES_VALIDATION"] : []),
        "SCELLEMENT_V2_APRES_VALIDATION_METIER",
      ];
    case "LEGACY_UNSEALED":
      return ["CONSERVER_LIGNE_SANS_SCEAU", "NE_PUBLIER_AUCUN_DOCUMENT"];
    case "NO_ACTION_REQUIRED":
      return [];
    default:
      return [];
  }
}

function rationaleFor(status: MigrationStatus, sealState: SealState, kind: SessionMatchKind): string {
  const seal = sealState === "LEGACY_V1" ? "sceau v1" : sealState === "UNSEALED" ? "non scellée" : sealState === "MALFORMED" ? "sceau illisible" : "sceau v2";
  const session = kind === "ALREADY_LINKED" ? "session liée" : kind === "UNIQUE_CANDIDATE" ? "session candidate unique" : kind === "AMBIGUOUS" ? "session ambiguë" : kind === "NONE" ? "aucune session" : "session non applicable";
  return `Ligne ${seal}, ${session} → ${status}.`;
}

/** Garde-fou de non-divulgation : aucun champ sensible ne doit apparaître. */
export function redactMigrationReport(report: MigrationReport): MigrationReport {
  const serialized = JSON.stringify(report);
  for (const key of SENSITIVE_KEYS) {
    if (new RegExp(`"${key}":`).test(serialized)) throw new Error(`Champ potentiellement sensible dans le rapport: ${key}`);
  }
  return report;
}
