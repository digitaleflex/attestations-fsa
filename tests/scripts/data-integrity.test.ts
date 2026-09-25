import { describe, expect, it } from "vitest";
import {
  analyzeSnapshot,
  compareWithBaseline,
  parseArgs,
  redactReport,
  type AttestationRow,
  type IntegrityReport,
  type IntegritySnapshot,
  type SessionRow,
  type StoredObjectRow,
} from "../../scripts/check-data-integrity";

const NOW = new Date("2026-09-25T12:00:00.000Z");

function attestation(overrides: Partial<AttestationRow> = {}): AttestationRow {
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
    pdfUrl: null,
    pdfKey: null,
    pdfHash: null,
    pdfVersion: null,
    pdfGeneratedAt: null,
    certificationScore: 82,
    certificationMention: "BIEN",
    certificationHours: 20,
    sealHash: "a".repeat(64),
    sealedAt: new Date("2026-09-21T00:00:00.000Z"),
    sealVersion: 1,
    ...overrides,
  };
}

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "session-1",
    userId: "user-1",
    examId: "exam-1",
    status: "GRADED",
    scorePart1: 16,
    scorePart2: 32,
    scorePart3: 34,
    totalScore: 82,
    finalScore: 82,
    internshipScore: 0,
    startedAt: new Date("2026-09-01T00:00:00.000Z"),
    submittedAt: new Date("2026-09-20T00:00:00.000Z"),
    gradedAt: new Date("2026-09-20T12:00:00.000Z"),
    ...overrides,
  };
}

function snapshot(overrides: Partial<IntegritySnapshot> = {}): IntegritySnapshot {
  return {
    attestations: [attestation()],
    sessions: [session()],
    storedObjects: [],
    internshipRequests: [],
    exams: [{
      id: "exam-1",
      formationId: "formation-1",
      status: "PUBLISHED",
      part1Points: 20,
      part2Points: 40,
      part3Points: 40,
      part1Enabled: true,
      part2Enabled: true,
      part3Enabled: true,
      totalPoints: 100,
    }],
    userIds: new Set(["user-1"]),
    formationIds: new Set(["formation-1"]),
    pdfKeyColumnPresent: true,
    storedObjectTablePresent: true,
    ...overrides,
  };
}

describe("check-data-integrity (#255)", () => {
  it("force le mode lecture seule et refuse toute option de mutation", () => {
    expect(parseArgs(["--dry-run", "--read-only", "--report", "tmp/report.json", "--baseline", "tmp/base.json"]))
      .toEqual({ dryRun: true, readOnly: true, reportPath: "tmp/report.json", baselinePath: "tmp/base.json" });
    expect(() => parseArgs(["--fix"])).toThrow(/Option inconnue/);
  });

  it("produit un inventaire stable sans valeur PII", () => {
    const report = analyzeSnapshot(snapshot(), NOW);
    const serialized = JSON.stringify(report);

    expect(report.summary.critical).toBe(0);
    expect(report.inventory.attestations[0]).toMatchObject({
      year: "2026",
      month: "09",
      sequence: "00001",
      hasSession: true,
      hasSeal: true,
      proofComplete: true,
    });
    expect(serialized).not.toContain("Personne Confidentielle");
    expect(serialized).not.toContain("personne@example.test");
    expect(serialized).not.toContain("attestation-1");
    expect(serialized).not.toContain("FSA-2026-M09-00001-abcde");
    expect(() => redactReport(report)).not.toThrow();
  });

  it("détecte code invalide, doublon, liens, dates et preuve PDF persistée", () => {
    const broken = snapshot({
      attestations: [
        attestation({ id: "a1", code: "FSA-2026-M13-00000-ZZZZZ" }),
        attestation({ id: "a1b", code: "FSA-2026-M13-00000-abcde" }),
        attestation({ id: "a2", sessionId: null, userId: null, formationId: "missing", startDate: new Date("2026-10-01"), endDate: new Date("2026-09-01"), certificationScore: null, certificationMention: null, sealHash: null, sealedAt: null, pdfUrl: "https://r2.example/document.pdf?X-Amz-Signature=abc", pdfKey: null }),
        attestation({ id: "a3", sessionId: "missing-session" }),
      ],
    });
    const checks = analyzeSnapshot(broken, NOW).findings.map((finding) => finding.check);

    expect(checks).toContain("FSA.code.format");
    expect(checks).toContain("FSA.code.month");
    expect(checks).toContain("FSA.code.sequence");
    expect(checks).toContain("FSA.code.unique");
    expect(checks).toContain("FSA.sessionId.required");
    expect(checks).toContain("FSA.dates.range");
    expect(checks).toContain("FSA.proof.certification");
    expect(checks).toContain("FSA.pdf.signed-persisted");
    expect(checks).toContain("FSA.session.link");
  });

  it("fige l’inventaire : ajout warned, changement et suppression critiques", () => {
    const baseline = analyzeSnapshot(snapshot(), NOW);
    const changed = analyzeSnapshot(snapshot({
      attestations: [attestation({ code: "FSA-2026-M09-00001-bcdef" })],
      sessions: [],
    }), NOW);
    const comparison = compareWithBaseline(changed, baseline);
    expect(comparison).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "CRITICAL", check: "REFERENCE.code.changed" }),
    ]));

    const removed = analyzeSnapshot(snapshot({ attestations: [], sessions: [] }), NOW);
    expect(compareWithBaseline(removed, baseline)).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "CRITICAL", check: "REFERENCE.removed" }),
    ]));

    const added = analyzeSnapshot(snapshot({
      attestations: [attestation(), attestation({ id: "attestation-2", code: "FSA-2026-M09-00002-bcdef", sessionId: "session-2" })],
      sessions: [session(), session({ id: "session-2" })],
    }), NOW);
    expect(compareWithBaseline(added, baseline).filter((finding) => finding.check === "REFERENCE.added"))
      .toHaveLength(2);
  });

  it("contrôle les statuts, relations et inversions de sessions", () => {
    const report = analyzeSnapshot(snapshot({
      sessions: [session({ status: "GRADED", scorePart2: null, finalScore: 120, userId: "missing-user", examId: "missing-exam", startedAt: new Date("2026-09-22"), submittedAt: new Date("2026-09-21") })],
    }), NOW);
    const checks = report.findings.map((finding) => finding.check);

    expect(report.summary.critical).toBeGreaterThan(0);
    expect(checks).toEqual(expect.arrayContaining([
      "FSA.session.graded",
      "FSA.session.finalScore",
      "FSA.session.user",
      "FSA.session.exam",
      "FSA.session.dates",
    ]));
  });
});

describe("registre des objets stockés (#260)", () => {
  function storedObject(overrides: Partial<StoredObjectRow> = {}): StoredObjectRow {
    return {
      id: "obj-1",
      key: "cv/abcdefghijkl.pdf",
      ownerUserId: "user-1",
      purpose: "cv",
      linkedEntityType: null,
      linkedEntityId: null,
      checksum: "a".repeat(64),
      retentionUntil: null,
      ...overrides,
    };
  }

  it("accepte un registre conforme", () => {
    const report = analyzeSnapshot(
      snapshot({
        storedObjects: [
          storedObject(),
          storedObject({ id: "obj-2", key: "stages/abcdefghjkl.pdf", ownerUserId: null, purpose: "internship" }),
          storedObject({
            id: "obj-3",
            key: "attestations/FSA-2026-M09-00001-abcde/v1.pdf",
            purpose: "attestation",
            linkedEntityType: "Attestation",
            linkedEntityId: "attestation-1",
          }),
        ],
        internshipRequests: [
          { id: "intern-1", userId: null, cvUrl: null, cvKey: "stages/abcdefghjkl.pdf" },
        ],
      }),
      NOW,
    );
    expect(report.findings.filter((finding) => finding.check.startsWith("STORAGE."))).toEqual([]);
  });

  it("refuse une clé hors préfixes autorisés, une URL signée et une empreinte invalide", () => {
    const checks = analyzeSnapshot(
      snapshot({
        storedObjects: [
          storedObject({ id: "obj-1", key: "legacy/doc.pdf" }),
          storedObject({ id: "obj-2", key: "cv/abcdefghjkl.pdf?X-Amz-Signature=abc" }),
          storedObject({ id: "obj-3", checksum: "pas-un-sha" }),
        ],
      }),
      NOW,
    ).findings.map((finding) => finding.check);

    expect(checks).toEqual(expect.arrayContaining([
      "STORAGE.key.prefix",
      "STORAGE.key.signed",
      "STORAGE.checksum.format",
    ]));
  });

  it("signale un propriétaire absent et un PDF officiel sans entité liée", () => {
    const report = analyzeSnapshot(
      snapshot({
        storedObjects: [
          storedObject({ id: "obj-1", ownerUserId: "user-disparu" }),
          storedObject({
            id: "obj-2",
            key: "attestations/FSA-2026-M09-00001-abcde/v1.pdf",
            purpose: "attestation",
          }),
        ],
      }),
      NOW,
    );
    const checks = report.findings.map((finding) => finding.check);
    expect(checks).toContain("STORAGE.owner.link");
    expect(checks).toContain("STORAGE.official.link");
  });

  it("détecte une URL signée persistée sur une candidature et une clé non enregistrée", () => {
    const checks = analyzeSnapshot(
      snapshot({
        internshipRequests: [
          {
            id: "intern-1",
            userId: null,
            cvUrl: "https://r2.example/cv/a.pdf?X-Amz-Signature=abc",
            cvKey: "stages/abcdefghjkl.pdf",
          },
        ],
      }),
      NOW,
    ).findings.map((finding) => finding.check);

    expect(checks).toContain("STORAGE.internship.signed-persisted");
    expect(checks).toContain("STORAGE.internship.key.unregistered");
  });

  it("avertit si la table StoredObject est absente du modèle courant", () => {
    const checks = analyzeSnapshot(snapshot({ storedObjectTablePresent: false }), NOW).findings.map(
      (finding) => finding.check,
    );
    expect(checks).toContain("STORAGE.schema");
  });
});
