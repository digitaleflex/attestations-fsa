import { describe, expect, it } from "vitest";
import {
  classifySnapshot,
  redactMigrationReport,
  FSA_CODE_PATTERN,
  type MigrationAttestationRow,
  type MigrationSessionRow,
  type MigrationSnapshot,
} from "@/lib/attestations/migration";
import { FSA_CODE_RE } from "../../../scripts/check-data-integrity";

const NOW = new Date("2026-09-25T12:00:00.000Z");

function attestation(overrides: Partial<MigrationAttestationRow> = {}): MigrationAttestationRow {
  return {
    id: "attestation-1",
    code: "FSA-2026-M09-00001-abcde",
    userId: "user-1",
    formationId: "formation-1",
    sessionId: "session-1",
    status: "VALIDATED",
    type: "CERTIFICATION",
    fullName: "Personne Confidentielle",
    email: "personne@example.test",
    birthDate: new Date("1990-01-01T00:00:00.000Z"),
    birthPlace: "Lieu confidentiel",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2026-09-20T00:00:00.000Z"),
    issuedAt: new Date("2026-09-21T00:00:00.000Z"),
    location: "FSA",
    instructor: "Direction",
    issuingCompany: "FSA",
    pdfKey: "attestations/FSA-2026-M09-00001-abcde/v1.pdf",
    pdfHash: "b".repeat(64),
    pdfVersion: 1,
    pdfGeneratedAt: new Date("2026-09-21T00:00:00.000Z"),
    certificationScore: 82,
    certificationMention: "BIEN",
    certificationHours: 20,
    sealHash: null,
    sealedAt: null,
    sealVersion: null,
    ...overrides,
  };
}

function session(overrides: Partial<MigrationSessionRow> = {}): MigrationSessionRow {
  return {
    id: "session-1",
    userId: "user-1",
    examId: "exam-1",
    status: "GRADED",
    finalScore: 82,
    startedAt: new Date("2026-09-01T00:00:00.000Z"),
    submittedAt: new Date("2026-09-20T00:00:00.000Z"),
    gradedAt: new Date("2026-09-20T12:00:00.000Z"),
    ...overrides,
  };
}

function snapshot(overrides: Partial<MigrationSnapshot> = {}): MigrationSnapshot {
  return {
    attestations: [attestation()],
    sessions: [session()],
    exams: [{ id: "exam-1", formationId: "formation-1" }],
    userIds: new Set(["user-1"]),
    formationIds: new Set(["formation-1"]),
    ...overrides,
  };
}

const statusOf = (rows: ReturnType<typeof classifySnapshot>, index = 0) => rows.records[index].migrationStatus;

describe("classifySnapshot — statuts de migration (#259)", () => {
  it("aligne son motif de code sur l'inventaire #255", () => {
    expect(FSA_CODE_PATTERN.source).toBe(FSA_CODE_RE.source);
  });

  it("propose un scellement v2 quand la preuve est complète, sans l'appliquer", () => {
    const report = classifySnapshot(snapshot(), NOW);
    expect(statusOf(report)).toBe("SEALABLE_WITH_EVIDENCE");
    expect(report.records[0].proposedActions).toContain("SCELLEMENT_V2_APRES_VALIDATION_METIER");
    expect(report.records[0].sessionMatch).toMatchObject({ kind: "ALREADY_LINKED", autoLink: false });
    expect(report.records[0].requiresBusinessApproval).toBe(true);
    expect(report).toMatchObject({ mode: "dry-run", readOnlyDatabase: true, applyRefused: true, writesPerformed: 0, generatedPdf: 0, resealedRows: 0 });
  });

  it("classe SEALABLE la ligne dont la preuve PDF est complète mais le sceau est v1", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ sealHash: "a".repeat(64), sealedAt: NOW, sealVersion: 1 })],
    }), NOW);
    expect(statusOf(report)).toBe("SEALABLE_WITH_EVIDENCE");
    expect(report.records[0].evidence.sealState).toBe("LEGACY_V1");
  });

  it("déclare NO_ACTION_REQUIRED sur une ligne déjà scellée en v2", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ sealHash: "a".repeat(64), sealedAt: NOW, sealVersion: 2 })],
    }), NOW);
    expect(statusOf(report)).toBe("NO_ACTION_REQUIRED");
    expect(report.records[0].proposedActions).toEqual([]);
  });

  it("laisse intacte une ligne historique non scellée et sans document officiel", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({
        sessionId: null, status: "VALIDATED", type: "FORMATION",
        pdfKey: null, pdfHash: null, pdfVersion: null, pdfGeneratedAt: null,
      })],
    }), NOW);
    expect(statusOf(report)).toBe("LEGACY_UNSEALED");
    expect(report.records[0].proposedActions).toEqual(["CONSERVER_LIGNE_SANS_SCEAU", "NE_PUBLIER_AUCUN_DOCUMENT"]);
    expect(report.records[0].sessionMatch.kind).toBe("NOT_APPLICABLE");
  });

  it("demande une réémission quand le sceau existe sans document officiel probant", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({
        pdfKey: null, pdfHash: null, pdfVersion: null, pdfGeneratedAt: null,
        sealHash: "a".repeat(64), sealedAt: NOW, sealVersion: 1,
      })],
    }), NOW);
    expect(statusOf(report)).toBe("REISSUE");
    expect(report.records[0].proposedActions).toEqual(["REEMETTRE_DOCUMENT_OFFICIEL_AVEC_NOUVEAU_CODE"]);
  });

  it("classe REVOKED les attestations rejetées, sans proposer de document", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ status: "REJECTED", type: "FORMATION", sessionId: null, certificationScore: null, certificationMention: null })],
    }), NOW);
    expect(statusOf(report)).toBe("REVOKED");
    expect(report.records[0].proposedActions).toEqual(["FIGER_LIGNE", "NE_PUBLIER_AUCUN_DOCUMENT"]);
  });

  it("bloque la période inversée et les anomalies de dates", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({
        startDate: new Date("2026-10-01T00:00:00.000Z"),
        endDate: new Date("2026-09-20T00:00:00.000Z"),
      })],
    }), NOW);
    expect(statusOf(report)).toBe("MIGRATION_BLOCKED");
    expect(report.records[0].blockers).toContain("PERIOD_INVERTED");
    expect(report.records[0].proposedActions).toEqual(["AUCUNE_ACTION_AUTOMATIQUE", "DECISION_METIER_OBLIGATOIRE"]);
    expect(report.findings.some((finding) => finding.check === "MIGRATION.PERIOD_INVERTED" && finding.severity === "CRITICAL")).toBe(true);
  });

  it("bloque aussi émission antérieure, code invalide et lien rompu", () => {
    const report = classifySnapshot(snapshot({
      attestations: [
        attestation({ id: "a1", code: "FSA-2026-M09-00001-aaaaa", issuedAt: new Date("2026-09-19T00:00:00.000Z") }),
        attestation({ id: "a2", code: "PAS-UN-CODE", sessionId: "missing", userId: "ghost" }),
        attestation({ id: "a3", code: "FSA-2026-M09-00003-aaaaa", sessionId: "session-2" }),
      ],
      sessions: [session(), session({ id: "session-2", userId: "user-2" })],
      userIds: new Set(["user-1", "user-2"]),
    }), NOW);
    const byHash = new Map(report.records.map((record) => [record.sequence, record]));
    expect(report.summary.byMigrationStatus.MIGRATION_BLOCKED).toBe(3);
    expect(byHash.get("00001")?.blockers).toContain("ISSUED_BEFORE_PERIOD_END");
    expect(report.records.find((record) => record.blockers.includes("CODE_FORMAT_INVALID"))).toBeDefined();
    expect(report.records.find((record) => record.blockers.includes("USER_LINK_BROKEN"))?.blockers).toContain("SESSION_LINK_BROKEN");
    expect(byHash.get("00003")?.blockers).toContain("SESSION_OTHER_CANDIDATE");
  });

  it("détecte code dupliqué et séquence réutilisée sans jamais renuméroter", () => {
    const report = classifySnapshot(snapshot({
      attestations: [
        attestation({ id: "a1", code: "FSA-2026-M09-00001-abcde" }),
        attestation({ id: "a2", code: "FSA-2026-M09-00001-abcde" }),
        attestation({ id: "a3", code: "FSA-2026-M09-00001-fghij" }),
      ],
    }), NOW);
    const withBlocker = (code: string) => report.records.filter((record) => record.blockers.includes(code));
    expect(withBlocker("CODE_DUPLICATE")).toHaveLength(1);
    expect(withBlocker("CODE_SEQUENCE_REUSED")).toHaveLength(1);
    expect(withBlocker("CODE_DUPLICATE")[0].codeHash).toBe(withBlocker("CODE_SEQUENCE_REUSED")[0].codeHash);
    // Aucun code en clair, aucune séquence recalculée dans le rapport.
    expect(JSON.stringify(report)).not.toContain("FSA-2026-M09-00001");
    expect(report.records.every((record) => record.requiresBusinessApproval)).toBe(true);
  });

  it("ne rattache jamais automatiquement une session et refuse l’ambiguïté", () => {
    const ambiguous = classifySnapshot(snapshot({
      attestations: [attestation({ sessionId: null })],
      sessions: [session({ id: "session-a" }), session({ id: "session-b" })],
    }), NOW);
    expect(ambiguous.records[0].sessionMatch).toMatchObject({ kind: "AMBIGUOUS", candidateCount: 2, autoLink: false });
    expect(ambiguous.records[0].migrationStatus).toBe("REQUIRES_REVIEW");
    expect(ambiguous.records[0].proposedActions).toEqual(["RESOUDRE_CORRESPONDANCE_SESSION", "RATTACHER_SESSION_APRES_VALIDATION"]);
    expect(ambiguous.findings.some((finding) => finding.check === "MIGRATION.session.ambiguous")).toBe(true);
  });

  it("propose une session candidate unique sans l’appliquer", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ sessionId: null })],
      sessions: [session({ id: "session-a" })],
    }), NOW);
    expect(report.records[0].sessionMatch.kind).toBe("UNIQUE_CANDIDATE");
    expect(report.records[0].sessionMatch.candidateRefs[0]).toMatch(/^session#[0-9a-f]{16}$/);
    expect(report.records[0].proposedActions).toEqual(["RATTACHER_SESSION_APRES_VALIDATION", "SCELLEMENT_V2_APRES_VALIDATION_METIER"]);
  });

  it("bloque une certification sans session rattachable", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ sessionId: null, userId: null })],
      sessions: [],
    }), NOW);
    expect(statusOf(report)).toBe("MIGRATION_BLOCKED");
    expect(report.records[0].blockers).toContain("CERTIFICATION_WITHOUT_SESSION");
  });

  it("bloque un score certifié supérieur au score de session", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ certificationScore: 95 })],
      sessions: [session({ finalScore: 60 })],
    }), NOW);
    expect(statusOf(report)).toBe("MIGRATION_BLOCKED");
    expect(report.records[0].blockers).toContain("CERTIFIED_SCORE_ABOVE_SESSION");
    expect(report.records[0].evidence.scoreDeltaBucket).toBe("gap");
  });

  it("bloque une preuve incomplète ou un sceau illisible", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ fullName: "   ", sealHash: "court", sealedAt: NOW, sealVersion: 2 })],
    }), NOW);
    expect(report.records[0].blockers).toEqual(expect.arrayContaining(["PROOF_INCOMPLETE", "SEAL_HASH_MALFORMED"]));
  });

  it("place les attestations PENDING en revue", () => {
    const report = classifySnapshot(snapshot({
      attestations: [attestation({ status: "PENDING" })],
    }), NOW);
    expect(statusOf(report)).toBe("REQUIRES_REVIEW");
  });

  it("produit un rapport sans PII ni code en clair", () => {
    const report = classifySnapshot(snapshot(), NOW);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("Personne Confidentielle");
    expect(serialized).not.toContain("personne@example.test");
    expect(serialized).not.toContain("attestation-1");
    expect(serialized).not.toContain("FSA-2026-M09-00001-abcde");
    expect(serialized).not.toContain("session-1");
    expect(() => redactMigrationReport(report)).not.toThrow();
  });

  it("agrège les compteurs et reste stable entre deux exécutions", () => {
    const report = classifySnapshot(snapshot(), NOW);
    expect(report.summary).toMatchObject({ attestations: 1, blockingAnomalies: 0, reviewRequired: 0 });
    expect(report.summary.byMigrationStatus).toEqual({ SEALABLE_WITH_EVIDENCE: 1 });
    expect(report.distributions.bySealState).toEqual({ UNSEALED: 1 });
    expect(classifySnapshot(snapshot(), NOW).records).toEqual(report.records);
  });

  it("produit un rapport DÉTERMINISTE : l'ordre de lecture des lignes n'y change rien", () => {
    const base = snapshot();
    const extra = attestation({ id: "attestation-2", code: "FSA-2026-M09-00002-bcdef" });
    const multi = { ...base, attestations: [extra, ...base.attestations] };
    const first = classifySnapshot(multi, NOW);
    const second = classifySnapshot({ ...multi, attestations: [...multi.attestations].reverse() }, NOW);

    const stable = (report: typeof first) => {
      const { generatedAt, ...rest } = report;
      void generatedAt;
      return JSON.stringify(rest);
    };
    expect(stable(second)).toBe(stable(first));
    // L'horodatage d'exécution est la SEULE variation tolérée.
    expect(classifySnapshot(multi, new Date("2027-01-02T03:04:05.000Z")).generatedAt).not.toBe(first.generatedAt);
  });

  it("classe la période inversée en MIGRATION_BLOCKED sans la corriger", () => {
    const report = classifySnapshot(
      snapshot({ attestations: [attestation({ startDate: new Date("2026-09-20T00:00:00.000Z"), endDate: new Date("2026-09-01T00:00:00.000Z") })] }),
      NOW,
    );
    expect(report.records[0].migrationStatus).toBe("MIGRATION_BLOCKED");
    expect(report.records[0].blockers).toContain("PERIOD_INVERTED");
    expect(report.records[0].proposedActions).toEqual(["AUCUNE_ACTION_AUTOMATIQUE", "DECISION_METIER_OBLIGATOIRE"]);
    expect(report.summary.blockingAnomalies).toBeGreaterThan(0);
    expect(report.findings.some((finding) => finding.check === "MIGRATION.PERIOD_INVERTED" && finding.severity === "CRITICAL")).toBe(true);
  });
});
