import { describe, expect, it } from "vitest";

import {
  ARCHIVED_SESSION_STATUS,
  ATTESTATION_PHYSICAL_DELETE_REFUSED,
  LIFECYCLE_REASON_MIN_LENGTH,
  LIFECYCLE_AUDIT_ACTIONS,
  isArchivedSession,
  isIssued,
  notificationAudience,
  parseLifecycleReason,
  retrogradePlan,
  revokePlan,
  softDeletePlan,
} from "@/lib/attestations/lifecycle";

const NOW = new Date("2026-09-26T10:00:00.000Z");

function makeAttestation(overrides: Record<string, unknown> = {}) {
  return {
    id: "att-1",
    code: "FSA-2026-M09-00001-abcde",
    status: "VALIDATED",
    userId: "user-1",
    sessionId: "session-1",
    formationId: "formation-1",
    pdfKey: "attestations/att-1.pdf",
    pdfHash: "a".repeat(64),
    sealHash: "b".repeat(64),
    sealedAt: new Date("2026-01-01T00:00:00.000Z"),
    sealVersion: 2,
    deletedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

describe("parseLifecycleReason (#299 / #301)", () => {
  it("refuse un motif absent, vide, trop court ou non textuel", () => {
    expect(parseLifecycleReason(undefined).ok).toBe(false);
    expect(parseLifecycleReason("").ok).toBe(false);
    expect(parseLifecycleReason("   ").ok).toBe(false);
    expect(parseLifecycleReason("abc").ok).toBe(false);
    expect(parseLifecycleReason(42).ok).toBe(false);
    expect(parseLifecycleReason({ reason: "Fraude avérée" }).ok).toBe(false);
  });

  it("accepte un motif exploitable et le normalise", () => {
    const parsed = parseLifecycleReason("  Fraude avérée  ");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.reason).toBe("Fraude avérée");
  });

  it("expose la longueur minimale et le refus de suppression physique", () => {
    expect(LIFECYCLE_REASON_MIN_LENGTH).toBe(5);
    expect(ATTESTATION_PHYSICAL_DELETE_REFUSED).toBe("ATTESTATION_PHYSICAL_DELETE_REFUSED");
  });
});

describe("isIssued", () => {
  it("ne considère comme émise que VALIDATED et CLAIMED", () => {
    expect(isIssued("VALIDATED")).toBe(true);
    expect(isIssued("CLAIMED")).toBe(true);
    expect(isIssued("PENDING")).toBe(false);
    expect(isIssued("REJECTED")).toBe(false);
    expect(isIssued("REVOKED")).toBe(false);
  });
});

describe("softDeletePlan (#299)", () => {
  it("ne touche jamais au PDF, au hash, au sceau ni au code", () => {
    const plan = softDeletePlan(makeAttestation({ status: "PENDING" }), { reason: "Doublon de saisie", actorId: "admin-1", now: NOW });
    expect(plan.data).toEqual({
      deletedAt: NOW,
      deletedById: "admin-1",
      deleteReason: "Doublon de saisie",
    });
    const issued = softDeletePlan(makeAttestation(), { reason: "Doublon de saisie", actorId: "admin-1", now: NOW });
    for (const preserved of ["pdfKey", "pdfHash", "pdfUrl", "pdfVersion", "pdfGeneratedAt", "sealHash", "sealedAt", "sealVersion", "code"]) {
      expect(plan.data).not.toHaveProperty(preserved);
      expect(issued.data).not.toHaveProperty(preserved);
    }
  });

  it("provoque une révocation publique datée si l'attestation était émise", () => {
    const validated = softDeletePlan(makeAttestation({ status: "VALIDATED" }), { reason: "Erreur de saisie", actorId: "admin-1", now: NOW });
    expect(validated.revoked).toBe(true);
    expect(validated.previousStatus).toBe("VALIDATED");
    expect(validated.data).toMatchObject({
      status: "REVOKED",
      revokedAt: NOW,
      revokedById: "admin-1",
      revokeReason: "Erreur de saisie",
      deletedAt: NOW,
    });

    const pending = softDeletePlan(makeAttestation({ status: "PENDING" }), { reason: "Doublon de saisie", actorId: "admin-1", now: NOW });
    expect(pending.revoked).toBe(false);
    expect(pending.data).not.toHaveProperty("status");
    expect(pending.data).not.toHaveProperty("revokedAt");
  });

  it("traite CLAIMED comme une attestation émise (récupérée par le titulaire)", () => {
    const claimed = softDeletePlan(makeAttestation({ status: "CLAIMED" }), { reason: "Attraction nominative", actorId: "admin-1", now: NOW });
    expect(claimed.revoked).toBe(true);
    expect(claimed.data).toMatchObject({ status: "REVOKED", revokedAt: NOW });
  });

  it("journalise l'action avec une trace d'audit dédiée", () => {
    expect(LIFECYCLE_AUDIT_ACTIONS.SOFT_DELETE).toBe("ATTESTATION_DELETED");
    expect(LIFECYCLE_AUDIT_ACTIONS.REVOKE).toBe("ATTESTATION_REVOKED");
    expect(LIFECYCLE_AUDIT_ACTIONS.RETROGRADE).toBe("USER_RETROGRADED");
  });
});

describe("revokePlan (#301)", () => {
  it("bascule en REVOKED avec date, auteur et motif, sans toucher au sceau", () => {
    const plan = revokePlan(makeAttestation(), { reason: "Fraude avérée", actorId: "admin-1", now: NOW });
    expect(plan.data).toEqual({
      status: "REVOKED",
      revokedAt: NOW,
      revokedById: "admin-1",
      revokeReason: "Fraude avérée",
    });
    expect(plan.data).not.toHaveProperty("sealHash");
    expect(plan.data).not.toHaveProperty("pdfKey");
  });

  it("ne re-selle pas une attestation officielle", () => {
    const plan = revokePlan(makeAttestation({ type: "CERTIFICATION" }), { reason: "Fraude avérée", actorId: "admin-1", now: NOW });
    expect(plan.data).not.toHaveProperty("sealHash");
    expect(plan.data).not.toHaveProperty("sealedAt");
  });
});

describe("retrogradePlan (#301)", () => {
  it("archive les sessions probantes au lieu de les supprimer", () => {
    const plan = retrogradePlan(makeAttestation(), { reason: "Examen à repasser", actorId: "admin-1", now: NOW });
    expect(plan.sessionArchive).not.toBeNull();
    expect(plan.sessionArchive?.data).toEqual({
      status: ARCHIVED_SESSION_STATUS,
      archivedAt: NOW,
      archivedById: "admin-1",
      archiveReason: "Examen à repasser",
    });
    expect(plan.sessionArchive?.where).toEqual({
      OR: [{ id: "session-1" }, { userId: "user-1", exam: { formationId: "formation-1" } }],
    });
    // Aucune clé de suppression : ni `delete`, ni `deleteMany`, ni `answers`.
    expect(Object.keys(plan.sessionArchive!)).toEqual(["where", "data"]);
    expect(plan.attestation).not.toHaveProperty("sealHash");
    expect(plan.attestation).not.toHaveProperty("answers");
  });

  it("réinitialise le statut et les scores, trace la rétrogradation", () => {
    const plan = retrogradePlan(makeAttestation(), { reason: "Examen à repasser", actorId: "admin-1", now: NOW });
    expect(plan.attestation).toEqual({
      status: "PENDING",
      certificationScore: 0,
      stageScore: 0,
      certificationHours: 0,
      stageHours: 0,
      retrogradedAt: NOW,
      retrogradedById: "admin-1",
      retrogradeReason: "Examen à repasser",
    });
  });

  it("ne propose aucune archive de session sans userId ni session liée", () => {
    const plan = retrogradePlan(makeAttestation({ userId: null, sessionId: null }), { reason: "Examen à repasser", actorId: "admin-1", now: NOW });
    expect(plan.sessionArchive).toBeNull();
    expect(plan.attestation).toMatchObject({ status: "PENDING" });
  });
});

describe("notificationAudience (#301)", () => {
  it("cible le titulaire quand un userId existe", () => {
    expect(notificationAudience(makeAttestation())).toEqual({ kind: "user", userId: "user-1" });
  });

  it("retombe sur les administrateurs pour un historique anonyme", () => {
    expect(notificationAudience(makeAttestation({ userId: null }))).toEqual({ kind: "admins", reason: "ANONYMOUS" });
    expect(notificationAudience(makeAttestation({ userId: "" }))).toEqual({ kind: "admins", reason: "ANONYMOUS" });
  });
});

describe("isArchivedSession", () => {
  it("reconnaît une session archivée, jamais une session supprimée", () => {
    expect(isArchivedSession({ status: "ARCHIVED", archivedAt: NOW })).toBe(true);
    expect(isArchivedSession({ status: "GRADED", archivedAt: null })).toBe(false);
  });
});
