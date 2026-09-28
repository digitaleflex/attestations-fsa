import { describe, expect, it } from "vitest";
import { canonicalJson, digestOf, sha256Hex } from "../../../lib/backup/canonical";
import {
  assertManifestIsSafe,
  BACKUP_MANIFEST_SCHEMA_VERSION,
  BackupManifestError,
  buildBackupManifest,
  parseBackupManifest,
  verifyBackupManifest,
  volumeLabel,
  type BackupManifest,
  type BackupManifestEntry,
} from "../../../lib/backup/manifest";

const entries: BackupManifestEntry[] = [
  { kind: "database", name: "db-backup-20260925-030000.dump", bytes: 4096, sha256: "a".repeat(64) },
  { kind: "volume", name: "uploads-public-20260925-030000.tar.gz", bytes: 1024, sha256: "b".repeat(64) },
];

const manifest = (): BackupManifest =>
  buildBackupManifest({ backupId: "db-backup-20260925-030000", createdAt: "2026-09-25T03:00:00.000Z", entries });

describe("manifeste de sauvegarde (#255)", () => {
  it("sérialise de façon canonique : clés triées, dates ISO, pas d'indépendance à l'ordre des clés", () => {
    const left = canonicalJson({ b: 1, a: { d: 2, c: [3, new Date("2026-01-01T00:00:00.000Z")] } });
    const right = canonicalJson({ a: { c: [3, new Date("2026-01-01T00:00:00.000Z")], d: 2 }, b: 1 });
    expect(left).toBe(right);
    expect(digestOf({ b: 1, a: 2 })).toBe(digestOf({ a: 2, b: 1 }));
    expect(sha256Hex("fsa")).toHaveLength(64);
  });

  it("enregistre hash, volume couvert et date, et se relit à l'identique", () => {
    const built = manifest();
    expect(built.schemaVersion).toBe(BACKUP_MANIFEST_SCHEMA_VERSION);
    expect(built.createdAt).toBe("2026-09-25T03:00:00.000Z");
    expect(built.coverage).toEqual({ database: true, volumes: ["public"] });
    expect(built.totalBytes).toBe(5120);
    expect(built.entries.map((entry) => entry.name)).toEqual([
      "db-backup-20260925-030000.dump",
      "uploads-public-20260925-030000.tar.gz",
    ]);
    expect(parseBackupManifest(JSON.parse(JSON.stringify(built)))).toEqual(built);
  });

  it("trie les entrées : le manifeste ne dépend pas de l'ordre de découverte", () => {
    const reversed = buildBackupManifest({
      backupId: "db-backup-20260925-030000",
      createdAt: "2026-09-25T03:00:00.000Z",
      entries: [...entries].reverse(),
    });
    expect(reversed.entries).toEqual(manifest().entries);
    expect(reversed.digest).toBe(manifest().digest);
  });

  it("détecte un artefactil altéré, absent ou non déclaré", () => {
    const built = manifest();
    const findings = verifyBackupManifest(built, [
      { ...entries[0], sha256: "c".repeat(64) },
      { ...entries[1] },
      { kind: "volume", name: "uploads-private-20260925-030000.tar.gz", bytes: 10, sha256: "d".repeat(64) },
    ]);
    const codes = findings.map((finding) => finding.check);
    expect(codes).toContain("MANIFEST.DIGEST_MISMATCH");
    expect(codes).toContain("MANIFEST.ENTRY_UNDECLARED");
    expect(findings.filter((finding) => finding.severity === "CRITICAL")).toHaveLength(1);
  });

  it("signale un artefact déclaré manquant et une taille divergente", () => {
    const built = manifest();
    const findings = verifyBackupManifest(built, [{ ...entries[0], bytes: 1 }]);
    expect(findings.map((finding) => finding.check)).toEqual([
      "MANIFEST.ENTRY_MISSING",
      "MANIFEST.SIZE_MISMATCH",
    ]);
  });

  it("refuse un manifeste vide, dupliqué, sans empreinte ou sans dump de base", () => {
    expect(() => buildBackupManifest({ backupId: "x", createdAt: "2026-09-25T03:00:00.000Z", entries: [] })).toThrow(BackupManifestError);
    expect(() => buildBackupManifest({ backupId: "x", createdAt: "2026-09-25T03:00:00.000Z", entries: [entries[0], entries[0]] })).toThrow(/dupliquée/);
    expect(() =>
      buildBackupManifest({
        backupId: "x",
        createdAt: "2026-09-25T03:00:00.000Z",
        entries: [{ ...entries[0], sha256: "nope" }],
      }),
    ).toThrow(/SHA-256/);
    const noDatabase = buildBackupManifest({
      backupId: "x",
      createdAt: "2026-09-25T03:00:00.000Z",
      entries: [entries[1]],
    });
    expect(noDatabase.coverage.database).toBe(false);
    expect(verifyBackupManifest(noDatabase, [entries[1]]).map((f) => f.check)).toContain("MANIFEST.DATABASE_NOT_COVERED");
  });

  it("rejette un manifeste altéré, un chemin absolu et une version inconnue", () => {
    const built = manifest();
    const tampered = { ...built, entries: [{ ...entries[0], bytes: 7 }] };
    expect(() => parseBackupManifest(tampered)).toThrow(/altéré/);
    expect(() => parseBackupManifest({ ...built, schemaVersion: 99 })).toThrow(/non prise en charge/);
    expect(() => parseBackupManifest({ ...built, entries: [] })).toThrow(/sans entrée/);
    expect(() =>
      buildBackupManifest({
        backupId: "x",
        createdAt: "2026-09-25T03:00:00.000Z",
        entries: [{ ...entries[0], name: "/home/audest/backups/dump" }],
      }),
    ).toThrow(/non sûr/);
  });

  it("n'expose ni secret, ni URL signée, ni chemin d'hôte", () => {
    const built = manifest();
    expect(() => assertManifestIsSafe(built)).not.toThrow();

    // Un nom syntaxiquement sûr mais signant une URL est bloqué À LA PUBLICATION :
    // le manifeste ne devient un artefact publiable qu'après ce contrôle.
    const leaky = { ...built, entries: [{ ...entries[0], name: "X-Amz-Signature.dump" }] };
    expect(() => assertManifestIsSafe(leaky)).toThrow(BackupManifestError);
  });

  it("déduit l'étiquette de volume d'un nom d'archive", () => {
    expect(volumeLabel("uploads-public-20260925-030000.tar.gz")).toBe("public");
    expect(volumeLabel("uploads-private-20260925-030000.tar.gz")).toBe("private");
    expect(volumeLabel("db-backup-20260925-030000.dump")).toBeNull();
  });
});
