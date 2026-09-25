import { describe, expect, it } from "vitest";
import {
  assertReferenceExportIsSafe,
  buildReferenceExport,
  REFERENCE_EXPORT_SCHEMA_VERSION,
  ReferenceExportUnsafeError,
  referenceExportDigest,
  serializeReferenceExport,
  type ReferenceSnapshot,
} from "../../../lib/attestations/reference-export";

const iso = (day: number) => new Date(`2026-0${day}T10:00:00.000Z`);

const snapshot: ReferenceSnapshot = {
  attestations: [
    {
      id: "att-1",
      code: "FSA-2025-M03-00012-abcde",
      status: "VALIDATED",
      type: "CERTIFICATION",
      formationId: "form-1",
      userId: "user-1",
      sessionId: "sess-1",
      issuedAt: iso(3),
      startDate: iso(1),
      endDate: iso(2),
      hasEmail: true,
      pdfKey: "attestations/x.pdf",
      pdfHash: "a".repeat(64),
      pdfVersion: 2,
      pdfGeneratedAt: iso(3),
      sealHash: "b".repeat(64),
      sealVersion: 2,
      certificationScore: 87.5,
    },
    {
      id: "att-2",
      code: "FSA-2025-M04-00013-bcdef",
      status: "PENDING",
      type: "FORMATION",
      formationId: "form-1",
      userId: null,
      sessionId: null,
      issuedAt: iso(4),
      // Période INVERSÉE : anomalie bloquante (#259).
      startDate: iso(6),
      endDate: iso(4),
      hasEmail: false,
      pdfKey: null,
      pdfHash: null,
      pdfVersion: null,
      pdfGeneratedAt: null,
      sealHash: null,
      sealVersion: null,
      certificationScore: null,
    },
  ],
  sessions: [
    {
      id: "sess-1",
      userId: "user-1",
      examId: "exam-1",
      status: "GRADED",
      startedAt: iso(1),
      submittedAt: iso(2),
      gradedAt: iso(3),
    },
  ],
  users: [
    { id: "user-1", role: "CANDIDAT", hasEmail: true },
    { id: "user-2", role: "ADMIN", hasEmail: true },
  ],
  formations: [{ id: "form-1", name: "Ferme Agro-Piscicole — Session de printemps" }],
};

describe("export de référence versionné et sûr (#255)", () => {
  it("versionne l'export et fige ses invariants de lecture seule", () => {
    const exported = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    expect(exported.schemaVersion).toBe(REFERENCE_EXPORT_SCHEMA_VERSION);
    expect(exported.mode).toBe("read-only");
    expect(exported.writesPerformed).toBe(0);
    expect(exported.piiIncluded).toBe(false);
  });

  it("couvre attestations, sessions, utilisateurs, formations et relations", () => {
    const exported = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    expect(exported.summary.attestations).toBe(2);
    expect(exported.summary.uniqueCodes).toBe(2);
    expect(exported.summary.sessions).toBe(1);
    expect(exported.summary.users).toBe(2);
    expect(exported.summary.formations).toBe(1);
    expect(exported.codes).toHaveLength(2);
    expect(exported.sessions[0].attestationRef).toBe(exported.codes[0].ref);
    const kinds = new Set(exported.relations.map((relation) => relation.kind));
    expect(kinds).toEqual(
      new Set(["attestation:user", "attestation:formation", "attestation:session", "session:user", "session:exam"]),
    );
    expect(exported.relations.every((relation) => !relation.broken)).toBe(true);
  });

  it("repère les périodes inversées sans les corriger", () => {
    const exported = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    expect(exported.summary.invertedPeriods).toBe(1);
    const inverted = exported.codes.filter((code) => code.periodInverted);
    expect(inverted).toHaveLength(1);
    expect(inverted[0].sequence).toBe("00013");
  });

  it("inventorie une relation cassée au lieu de la réparer", () => {
    const broken: ReferenceSnapshot = {
      ...snapshot,
      attestations: [{ ...snapshot.attestations[0], userId: "user-ghost" }],
    };
    const exported = buildReferenceExport(broken, new Date("2026-09-25T12:00:00.000Z"));
    expect(exported.summary.brokenRelations).toBeGreaterThan(0);
    expect(exported.codes[0].userRef).toBeTruthy();
    expect(exported.codes[0].sessionRef).toBeTruthy();
  });

  it("n'exporte ni PII, ni secret, ni code en clair", () => {
    const exported = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    expect(() => assertReferenceExportIsSafe(exported)).not.toThrow();
    const serialized = serializeReferenceExport(exported);
    expect(serialized).not.toContain("FSA-2025-M03-00012-abcde");
    expect(serialized).not.toContain("user-1");
    expect(serialized).not.toContain("att-1");
    expect(serialized).not.toContain("@");
    // Le libellé de catalogue est conservé : c'est ce qui rend l'export lisible.
    expect(serialized).toContain("Session de printemps");
  });

  it("refuse un export contaminé, sans jamais réémettre la valeur fautive", () => {
    const exported = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    const contaminated = {
      ...exported,
      users: [{ ...exported.users[0], email: "candidat@example.org" }],
    } as unknown as ReturnType<typeof buildReferenceExport>;
    expect(() => assertReferenceExportIsSafe(contaminated)).toThrow(ReferenceExportUnsafeError);
    try {
      assertReferenceExportIsSafe(contaminated);
    } catch (error) {
      expect((error as Error).message).not.toContain("candidat@example.org");
    }
  });

  it("est reproductible : même base, même empreinte, quel que soit l'ordre des lignes", () => {
    const first = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    const shuffled: ReferenceSnapshot = {
      attestations: [...snapshot.attestations].reverse(),
      sessions: [...snapshot.sessions].reverse(),
      users: [...snapshot.users].reverse(),
      formations: [...snapshot.formations].reverse(),
    };
    const second = buildReferenceExport(shuffled, new Date("2026-12-31T23:59:59.000Z"));

    expect(referenceExportDigest(second)).toBe(referenceExportDigest(first));
    expect(serializeReferenceExport(second)).not.toBe(serializeReferenceExport(first)); // generatedAt diffère
    expect(JSON.stringify(second.codes)).toBe(JSON.stringify(first.codes));
    expect(JSON.stringify(second.relations)).toBe(JSON.stringify(first.relations));
    expect(JSON.stringify(second.summary)).toBe(JSON.stringify(first.summary));
  });

  it("change d'empreinte dès qu'un code change (le gel est vérifiable)", () => {
    const before = buildReferenceExport(snapshot, new Date("2026-09-25T12:00:00.000Z"));
    const recoded: ReferenceSnapshot = {
      ...snapshot,
      attestations: [{ ...snapshot.attestations[0], code: "FSA-2025-M03-00099-abcde" }, snapshot.attestations[1]],
    };
    expect(referenceExportDigest(buildReferenceExport(recoded, new Date("2026-09-25T12:00:00.000Z")))).not.toBe(
      referenceExportDigest(before),
    );
  });
});
