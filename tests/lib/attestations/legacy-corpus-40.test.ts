/**
 * #301 — Corpus historique : les 40 attestations existantes restent vérifiables
 * et ne sont jamais supprimées.
 *
 * Le test s'appuie sur l'outil de référence `classifySnapshot`
 * (scripts/classify-attestation-migration.ts) et rejoue un instantané de 40
 * lignes historiques typiques : 38 sans userId (anonymes), 2 révocées, 4
 * certifications liées à une session GRADED, sceaux v1 hérités.
 *
 * Il verrouille deux invariants :
 *  1. l'inventaire reste exhaustif (40 lignes, 0 écriture, 0 rescelllement) ;
 *  2. le cycle de vie non destructif ne peut ni supprimer une attestation ni
 *     détruire une session probante (garde statique sur le code du cycle de vie).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import {
  classifySnapshot,
  FSA_CODE_PATTERN,
  type MigrationAttestationRow,
  type MigrationExamRow,
  type MigrationSessionRow,
  type MigrationSnapshot,
} from "@/lib/attestations/migration";
import { retrogradePlan, revokePlan, softDeletePlan } from "@/lib/attestations/lifecycle";

const NOW = new Date("2026-09-26T10:00:00.000Z");
const CORPUS_SIZE = 40;
/** Même empreinte que celle produite par l'outil de référence (sha256 du code). */
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function legacyRow(index: number): MigrationAttestationRow {
  const year = 2024 + (index % 2);
  const month = 1 + (index % 4);
  const sequence = 1 + Math.floor(index / 4);
  // Les 4 premières lignes sont des certifications officielles liées à une
  // session GRADED ; les 36 autres sont des historiques anonymes (sans compte).
  const certification = index < 4;
  const revoked = index % 20 === 7;
  const start = new Date(Date.UTC(year, month - 1, 5));
  const end = new Date(Date.UTC(year, month - 1, 20));
  return {
    id: `att-legacy-${String(index).padStart(2, "0")}`,
    code: `FSA-${year}-M${String(month).padStart(2, "0")}-${String(sequence).padStart(5, "0")}-${index.toString(16).padStart(5, "0")}`,
    // 36 lignes sur 40 sont des historiques anonymes (pas de compte candidat).
    userId: certification ? `user-${index}` : null,
    formationId: "formation-1",
    sessionId: certification ? `session-${index}` : null,
    status: revoked ? "REJECTED" : "VALIDATED",
    type: certification ? "CERTIFICATION" : index % 2 === 0 ? "FORMATION" : "STAGE",
    fullName: `Titulaire ${index}`,
    email: null,
    birthDate: new Date(Date.UTC(1990, 1, 1)),
    birthPlace: "Abomey-Calavi",
    startDate: start,
    endDate: end,
    issuedAt: new Date(Date.UTC(year, month - 1, 25)),
    location: "Abomey-Calavi",
    instructor: "Direction Technique FSA",
    issuingCompany: "FSA - Ferme Agro-Piscicole Cité St André",
    pdfKey: null,
    pdfHash: null,
    pdfVersion: null,
    pdfGeneratedAt: null,
    certificationScore: certification ? 72 : null,
    certificationMention: certification ? "BIEN" : null,
    certificationHours: certification ? 40 : null,
    // Sceau hérité v1 : présent mais non v2.
    sealHash: "c".repeat(64),
    sealedAt: new Date(Date.UTC(year, month - 1, 25)),
    sealVersion: 1,
  };
}

function buildSnapshot(): MigrationSnapshot {
  const attestations = Array.from({ length: CORPUS_SIZE }, (_, index) => legacyRow(index));
  const sessions: MigrationSessionRow[] = attestations
    .filter((row) => row.sessionId)
    .map((row) => ({
      id: row.sessionId as string,
      userId: row.userId ?? `user-anon-${row.id}`,
      examId: "exam-1",
      status: "GRADED",
      finalScore: 72,
      startedAt: row.startDate,
      submittedAt: row.endDate,
      gradedAt: row.issuedAt,
    }));
  const exams: MigrationExamRow[] = [{ id: "exam-1", formationId: "formation-1" }];
  return {
    attestations,
    sessions,
    exams,
    userIds: new Set(attestations.map((row) => row.userId).filter((value): value is string => Boolean(value))),
    formationIds: new Set(["formation-1"]),
  };
}

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectTypeScriptFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

function collectSources(dir: string): string[] {
  return collectTypeScriptFiles(dir).map((file) => readFileSync(file, "utf8"));
}

describe("corpus historique des 40 attestations — #301", () => {
  const snapshot = buildSnapshot();

  it("l'inventaire de référence reste exhaustif et strictement en lecture", () => {
    const report = classifySnapshot(snapshot, NOW);
    expect(snapshot.attestations).toHaveLength(CORPUS_SIZE);
    expect(report.summary.attestations).toBe(CORPUS_SIZE);
    expect(report.records).toHaveLength(CORPUS_SIZE);
    expect(report.writesPerformed).toBe(0);
    expect(report.generatedPdf).toBe(0);
    expect(report.resealedRows).toBe(0);
    expect(report.applyRefused).toBe(true);
    // Aucune ligne du corpus n'est proposée à la suppression : le seul statut
    // figé du référentiel est `REVOKED` (ligne gelée, document non publié).
    const removable = report.records.filter((record) =>
      record.proposedActions.some((action) => /DELETE|PURGE|SUPPRESS|DROP/i.test(action)),
    );
    expect(removable).toHaveLength(0);
    // Toutes les lignes restent classifiables (pas de blocage issu du corpus).
    expect(report.summary.blockingAnomalies).toBe(0);
  });

  it("tous les codes du corpus restent au format FSA et ne sont pas réécrits", () => {
    const report = classifySnapshot(snapshot, NOW);
    for (const row of snapshot.attestations) {
      expect(FSA_CODE_PATTERN.test(row.code)).toBe(true);
    }
    const codesHashed = new Set(report.records.map((record) => record.codeHash));
    expect(codesHashed.size).toBe(CORPUS_SIZE);
  });

  it("les 40 attestations restent vérifiables : le sceau et la preuve ne bougent pas", () => {
    for (const row of snapshot.attestations) {
      const soft = softDeletePlan(row, { reason: "Revue de corpus", actorId: "admin-1", now: NOW });
      const revoke = revokePlan(row, { reason: "Revue de corpus", actorId: "admin-1", now: NOW });
      const retro = retrogradePlan(row, { reason: "Revue de corpus", actorId: "admin-1", now: NOW });
      for (const plan of [soft.data, revoke.data, retro.attestation]) {
        expect(plan).not.toHaveProperty("code");
        expect(plan).not.toHaveProperty("pdfKey");
        expect(plan).not.toHaveProperty("pdfHash");
        expect(plan).not.toHaveProperty("sealHash");
        expect(plan).not.toHaveProperty("sealedAt");
      }
      // Aucune preuve probante n'est demandée par un plan de cycle de vie.
      const preserved = { ...row, ...soft.data };
      expect(preserved.sealHash).toBe(row.sealHash);
      expect(preserved.sealedAt).toEqual(row.sealedAt);
      expect(preserved.status === "REVOKED" || preserved.status === row.status).toBe(true);
    }
  });

  it("les sessions des certifications historiques sont archivées, jamais supprimées", () => {
    const linked = snapshot.attestations.filter((row) => row.sessionId);
    expect(linked).toHaveLength(4);
    for (const row of linked) {
      const retro = retrogradePlan(row, { reason: "Revue de corpus", actorId: "admin-1", now: NOW });
      expect(retro.sessionArchive).not.toBeNull();
      expect(retro.sessionArchive?.data).toMatchObject({ status: "ARCHIVED", archiveReason: "Revue de corpus" });
      // La ligne de session elle-même reste lisible : le filtre porte sur son
      // statut et son horodatage d'archivage, jamais sur une suppression.
      expect(Object.keys(retro.sessionArchive!)).toEqual(["where", "data"]);
    }
  });

  it("une ligne révoquée publiquement est figée : ni suppression ni réémission", () => {
    const revokedSnapshot = buildSnapshot();
    revokedSnapshot.attestations[0] = { ...revokedSnapshot.attestations[0], status: "REVOKED" };
    const report = classifySnapshot(revokedSnapshot, NOW);
    const record = report.records.find((entry) => entry.codeHash === sha256(revokedSnapshot.attestations[0].code));
    expect(record?.migrationStatus).toBe("REVOKED");
    expect(record?.proposedActions).toContain("FIGER_LIGNE");
    expect(record?.proposedActions).not.toContain("REEMETTRE_DOCUMENT_OFFICIEL_AVEC_NOUVEAU_CODE");
  });

  it("garde statique : aucun DELETE physique dans le cycle de vie des attestations", () => {    const sources = [
      ...collectSources("lib/attestations"),
      ...collectSources("app/api/attestations"),
      ...collectSources("app/api/admin/attestations"),
    ].join("\n");
    expect(sources).not.toMatch(/attestation\.delete\(/);
    expect(sources).not.toMatch(/attestation\.deleteMany\(/);
    expect(sources).not.toMatch(/examSession\.delete\w*\(/);
  });
});
