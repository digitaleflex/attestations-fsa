/**
 * Export de référence versionné et SÛR (#255).
 *
 * Finalité : un inventaire relisible et reproductible des attestations, sessions,
 * utilisateurs, formations et de leurs relations, à conserver comme artefact
 * versionné (PR, dépôt d'artefacts). Contraintes :
 *  - AUCUNE PII : ni nom, ni prénom, ni email, ni date/lieu de naissance, ni
 *    adresse, ni téléphone. Les entités sont désignées par une empreinte SHA-256
 *    tronquée (« ref ») ;
 *  - AUCUN secret : ni jeton, ni URL signée, ni clé d'objet R2, ni sceau brut ;
 *  - AUCUNE écriture : le module est PUR, la lecture se fait ailleurs en
 *    transaction `READ ONLY` ;
 *  - REPRODUCTIBLE : même base ⇒ même sérialisation, donc même empreinte
 *    (`referenceExportDigest`). Seul `generatedAt` varie d'une exécution à
 *    l'autre et il est exclu de l'empreinte.
 *
 * Les codes FSA ne sont jamais recopiés en clair : l'export en conserve
 * l'empreinte, l'année, le mois et la séquence — de quoi prouver l'inventaire
 * et le gel sans jamais diffuser un code imprimable.
 */
import { createHash } from "node:crypto";
import { canonicalJson, digestOf } from "../backup/canonical";

export const REFERENCE_EXPORT_SCHEMA_VERSION = 1 as const;
export const REFERENCE_EXPORT_GENERATOR = "scripts/export-reference.ts";

/** Format du code FSA, aligné sur `lib/attestations/migration.ts` (#255/#259). */
export const REFERENCE_CODE_PATTERN = /^FSA-(\d{4})-M(\d{2})-(\d{5})-([0-9a-f]{5})$/;

export interface ReferenceAttestationRow {
  id: string;
  code: string;
  status: string;
  type: string;
  formationId: string;
  userId: string | null;
  sessionId: string | null;
  issuedAt: Date;
  startDate: Date;
  endDate: Date;
  hasEmail: boolean;
  pdfKey: string | null;
  pdfHash: string | null;
  pdfVersion: number | null;
  pdfGeneratedAt: Date | null;
  sealHash: string | null;
  sealVersion: number | null;
  certificationScore: number | null;
}

export interface ReferenceSessionRow {
  id: string;
  userId: string;
  examId: string | null;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  gradedAt: Date | null;
}

export interface ReferenceUserRow {
  id: string;
  role: string;
  hasEmail: boolean;
}

export interface ReferenceFormationRow {
  id: string;
  name: string;
}

export interface ReferenceSnapshot {
  attestations: ReferenceAttestationRow[];
  sessions: ReferenceSessionRow[];
  users: ReferenceUserRow[];
  formations: ReferenceFormationRow[];
}

export interface ReferenceCodeEntry {
  ref: string;
  codeHash: string;
  year: string | null;
  month: string | null;
  sequence: string | null;
  status: string;
  type: string;
  sealed: boolean;
  sealVersion: number | null;
  hasPdfProof: boolean;
  hasEmail: boolean;
  periodInverted: boolean;
  userRef: string | null;
  formationRef: string | null;
  sessionRef: string | null;
}

export interface ReferenceRelation {
  kind: "attestation:user" | "attestation:formation" | "attestation:session" | "session:user" | "session:exam";
  from: string;
  to: string;
  /** Une relation cassée est inventoriée, pas corrigée. */
  broken: boolean;
}

export interface ReferenceExport {
  schemaVersion: typeof REFERENCE_EXPORT_SCHEMA_VERSION;
  generator: string;
  mode: "read-only";
  writesPerformed: 0;
  generatedAt: string;
  piiIncluded: false;
  summary: {
    attestations: number;
    uniqueCodes: number;
    sessions: number;
    users: number;
    formations: number;
    relations: number;
    brokenRelations: number;
    invertedPeriods: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byCodeYear: Record<string, number>;
  };
  codes: ReferenceCodeEntry[];
  users: Array<{ ref: string; role: string; hasEmail: boolean; attestations: number; sessions: number }>;
  formations: Array<{ ref: string; label: string; attestations: number }>;
  sessions: Array<{
    ref: string;
    status: string;
    hasSubmittedAt: boolean;
    hasGradedAt: boolean;
    attestationRef: string | null;
  }>;
  relations: ReferenceRelation[];
  legend: {
    codes: "empreinte du code + année/mois/séquence ; aucun code en clair",
    refs: "empreinte SHA-256 tronquée d'un identifiant interne ; aucune valeur brute",
    sealed: "sceau probant présent (valeur du sceau non exportée)",
  };
}

export class ReferenceExportUnsafeError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    // La raison ne réémet JAMAIS la valeur fautive : elle n'est que textuelle.
    super(`Export de référence non publiable : ${reason}`);
    this.reason = reason;
    this.name = "ReferenceExportUnsafeError";
  }
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ref = (kind: string, value: string) => `${kind}#${hash(value).slice(0, 16)}`;

/**
 * Comptage à clés TRIÉES : l'ordre d'insertion dépendrait de l'ordre de lecture
 * des lignes, ce qui casserait la reproductibilité de l'empreinte.
 */
const countBy = (values: string[]) => {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};

/** Analyse pure : construit l'export versionné à partir d'un snapshot déjà lu. */
export function buildReferenceExport(snapshot: ReferenceSnapshot, now = new Date()): ReferenceExport {
  const users = new Map(snapshot.users.map((user) => [user.id, user]));
  const formations = new Map(snapshot.formations.map((formation) => [formation.id, formation]));
  const sessions = new Map(snapshot.sessions.map((session) => [session.id, session]));
  // sessionId -> attestationId : une session n'est liée qu'à une seule
  // attestation (`@@unique([sessionId])`), la relation est donc univoque.
  const attestationBySession = new Map<string, string>();
  for (const row of snapshot.attestations) {
    if (row.sessionId) attestationBySession.set(row.sessionId, row.id);
  }

  const relations: ReferenceRelation[] = [];
  const codes: ReferenceCodeEntry[] = [];
  const seenCodes = new Set<string>();
  let invertedPeriods = 0;

  for (const row of [...snapshot.attestations].sort((a, b) => a.id.localeCompare(b.id))) {
    const codeMatch = REFERENCE_CODE_PATTERN.exec(row.code);
    const sealed = Boolean(row.sealHash);
    const periodInverted = row.startDate.getTime() > row.endDate.getTime();
    if (periodInverted) invertedPeriods += 1;
    const attestationRef = ref("attestation", row.id);

    if (row.userId) {
      relations.push({
        kind: "attestation:user",
        from: attestationRef,
        to: ref("user", row.userId),
        broken: !users.has(row.userId),
      });
    }
    relations.push({
      kind: "attestation:formation",
      from: attestationRef,
      to: ref("formation", row.formationId),
      broken: !formations.has(row.formationId),
    });
    if (row.sessionId) {
      relations.push({
        kind: "attestation:session",
        from: attestationRef,
        to: ref("session", row.sessionId),
        broken: !sessions.has(row.sessionId),
      });
    }

    codes.push({
      ref: attestationRef,
      codeHash: hash(row.code),
      year: codeMatch ? codeMatch[1] : null,
      month: codeMatch ? codeMatch[2] : null,
      sequence: codeMatch ? codeMatch[3] : null,
      status: row.status,
      type: row.type,
      sealed,
      sealVersion: row.sealVersion ?? null,
      hasPdfProof: Boolean(row.pdfKey && row.pdfHash && row.pdfVersion && row.pdfGeneratedAt),
      hasEmail: row.hasEmail,
      periodInverted,
      userRef: row.userId ? ref("user", row.userId) : null,
      formationRef: formations.has(row.formationId) ? ref("formation", row.formationId) : null,
      sessionRef: row.sessionId && sessions.has(row.sessionId) ? ref("session", row.sessionId) : null,
    });
    seenCodes.add(row.code);
  }

  for (const session of [...snapshot.sessions].sort((a, b) => a.id.localeCompare(b.id))) {
    relations.push({
      kind: "session:user",
      from: ref("session", session.id),
      to: ref("user", session.userId),
      broken: !users.has(session.userId),
    });
    if (session.examId) {
      relations.push({
        kind: "session:exam",
        from: ref("session", session.id),
        to: ref("exam", session.examId),
        broken: false,
      });
    }
  }

  const attestationsByUser = new Map<string, number>();
  const attestationsByFormation = new Map<string, number>();
  for (const row of snapshot.attestations) {
    if (row.userId) attestationsByUser.set(row.userId, (attestationsByUser.get(row.userId) ?? 0) + 1);
    attestationsByFormation.set(row.formationId, (attestationsByFormation.get(row.formationId) ?? 0) + 1);
  }
  const sessionsByUser = new Map<string, number>();
  for (const session of snapshot.sessions) {
    sessionsByUser.set(session.userId, (sessionsByUser.get(session.userId) ?? 0) + 1);
  }

  const linkedSessionIds = new Set(attestationBySession.keys());

  return {
    schemaVersion: REFERENCE_EXPORT_SCHEMA_VERSION,
    generator: REFERENCE_EXPORT_GENERATOR,
    mode: "read-only",
    writesPerformed: 0,
    generatedAt: now.toISOString(),
    piiIncluded: false,
    summary: {
      attestations: snapshot.attestations.length,
      uniqueCodes: seenCodes.size,
      sessions: snapshot.sessions.length,
      users: snapshot.users.length,
      formations: snapshot.formations.length,
      relations: relations.length,
      brokenRelations: relations.filter((relation) => relation.broken).length,
      invertedPeriods,
      byStatus: countBy(snapshot.attestations.map((row) => row.status)),
      byType: countBy(snapshot.attestations.map((row) => row.type)),
      byCodeYear: countBy(
        snapshot.attestations.flatMap((row) => (REFERENCE_CODE_PATTERN.exec(row.code) ? [REFERENCE_CODE_PATTERN.exec(row.code)![1]] : [])),
      ),
    },
    codes: codes.sort((a, b) => a.ref.localeCompare(b.ref)),
    users: snapshot.users
      .map((user) => ({
        ref: ref("user", user.id),
        role: user.role,
        hasEmail: user.hasEmail,
        attestations: attestationsByUser.get(user.id) ?? 0,
        sessions: sessionsByUser.get(user.id) ?? 0,
      }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
    formations: snapshot.formations
      .map((formation) => ({
        ref: ref("formation", formation.id),
        // Le libellé d'un catalogue de formations n'est pas une donnée
        // personnelle : il rend l'export relisible. Les participants ne le sont pas.
        label: formation.name,
        attestations: attestationsByFormation.get(formation.id) ?? 0,
      }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
    sessions: snapshot.sessions
      .map((session) => ({
        ref: ref("session", session.id),
        status: session.status,
        hasSubmittedAt: Boolean(session.submittedAt),
        hasGradedAt: Boolean(session.gradedAt),
        attestationRef: linkedSessionIds.has(session.id)
          ? ref("attestation", attestationBySession.get(session.id)!)
          : null,
      }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
    relations: relations.sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
    ),
    legend: {
      codes: "empreinte du code + année/mois/séquence ; aucun code en clair",
      refs: "empreinte SHA-256 tronquée d'un identifiant interne ; aucune valeur brute",
      sealed: "sceau probant présent (valeur du sceau non exportée)",
    },
  };
}

/** Empreinte reproductible de l'export : `generatedAt` en est exclue. */
export function referenceExportDigest(exported: ReferenceExport): string {
  const { generatedAt, ...stable } = exported;
  void generatedAt;
  return digestOf(stable);
}

export function serializeReferenceExport(exported: ReferenceExport): string {
  return `${JSON.stringify(exported, null, 2)}\n`;
}

export const FORBIDDEN_EXPORT_KEYS = [
  "code", "id", "userId", "formationId", "sessionId", "examId", "fullName", "firstName", "lastName",
  "name", "email", "birthDate", "birthPlace", "phone", "address", "gender", "password", "token",
  "accessToken", "refreshToken", "pdfUrl", "pdfKey", "pdfHash", "sealHash", "location", "instructor",
] as const;

const FORBIDDEN_VALUE_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "adresse email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { reason: "code FSA en clair", pattern: /FSA-\d{4}-M\d{2}-\d{5}-/ },
  { reason: "URL signée", pattern: /X-Amz-|Signature=|token=/i },
  { reason: "chemin d'hôte", pattern: /(^|[\s"'(])\/(?:home|Users|var|srv|root)\// },
  { reason: "secret en clair", pattern: /(?:password|secret|api[_-]?key)\s*[:=]/i },
];

/**
 * Garde-fou de publication : l'export ne peut être écrit que s'il ne contient
 * ni clé sensible, ni valeur sensible. Le contrôle est volontairement paranoid :
 * mieux vaut refuser un export que publier une PII dans un artefact versionné.
 */
export function assertReferenceExportIsSafe(exported: ReferenceExport): ReferenceExport {
  const serialized = canonicalJson(exported);
  for (const key of FORBIDDEN_EXPORT_KEYS) {
    if (new RegExp(`"${key}"\\s*:`).test(serialized)) {
      throw new ReferenceExportUnsafeError(`clé interdite présente (${key})`);
    }
  }
  for (const { reason, pattern } of FORBIDDEN_VALUE_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new ReferenceExportUnsafeError(`${reason} détectée`);
    }
  }
  return exported;
}
