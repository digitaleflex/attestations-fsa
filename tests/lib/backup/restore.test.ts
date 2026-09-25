import { describe, expect, it } from "vitest";
import { buildBackupManifest, type BackupManifestEntry } from "../../../lib/backup/manifest";
import {
  ALLOWED_RESTORE_HOSTS,
  ISOLATED_DATABASE_PATTERN,
  planRestore,
  RESTORE_PRODUCTION_REFUSAL_MESSAGE,
  RestoreRefusedError,
  serializeRestorePlan,
  type RestoreTarget,
} from "../../../lib/backup/restore";

const entries: BackupManifestEntry[] = [
  { kind: "database", name: "db-backup-20260925-030000.dump", bytes: 4096, sha256: "a".repeat(64) },
  { kind: "volume", name: "uploads-public-20260925-030000.tar.gz", bytes: 1024, sha256: "b".repeat(64) },
];
const manifest = () =>
  buildBackupManifest({ backupId: "db-backup-20260925-030000", createdAt: "2026-09-25T03:00:00.000Z", entries });

const isolated: RestoreTarget = { host: "localhost", database: "fsa_restore_20260925", user: "audest", port: 5432 };

describe("procédure de restauration testable localement (#255)", () => {
  it("produit un plan exécutable manuellement, sans jamais écrire", () => {
    const plan = planRestore({ manifest: manifest(), target: isolated, actuals: entries });
    expect(plan.executed).toBe(false);
    expect(plan.backupId).toBe("db-backup-20260925-030000");
    expect(plan.manifestDigest).toBe(manifest().digest);
    expect(plan.commands.join("\n")).toContain("createdb");
    expect(plan.commands.join("\n")).toContain("pg_restore");
    expect(plan.commands.join("\n")).toContain("--clean --if-exists --no-owner");
    // Les volumes sont.restore vérifiés, pas écrasés.
    expect(plan.commands.join("\n")).toContain("sha256sum");
    expect(plan.postRestoreChecks.length).toBeGreaterThan(0);
  });

  it("est déterministe : deux exécutions sur les mêmes entrées donnent le même plan", () => {
    const a = serializeRestorePlan(planRestore({ manifest: manifest(), target: isolated, actuals: entries }));
    const b = serializeRestorePlan(planRestore({ manifest: manifest(), target: isolated, actuals: [...entries].reverse() }));
    expect(a).toBe(b);
  });

  it("refuse toute cible qui n'est pas une base locale isolée", () => {
    for (const target of [
      { host: "prod.example.org", database: "fsa_restore_20260925" },
      { host: "localhost", database: "attestation_fsa" },
      { host: "localhost", database: "fsa_restore_20260925; DROP DATABASE postgres" },
    ] satisfies RestoreTarget[]) {
      expect(() => planRestore({ manifest: manifest(), target, actuals: entries })).toThrow(RestoreRefusedError);
      expect(() => planRestore({ manifest: manifest(), target, actuals: entries })).toThrow(RESTORE_PRODUCTION_REFUSAL_MESSAGE);
    }
    expect(ALLOWED_RESTORE_HOSTS).toContain("localhost");
    expect(ISOLATED_DATABASE_PATTERN.test("fsa_restore_local")).toBe(true);
    expect(ISOLATED_DATABASE_PATTERN.test("attestation_fsa")).toBe(false);
  });

  it("refuse une restauration dont la sauvegarde ne correspond plus à son manifeste", () => {
    expect(() =>
      planRestore({ manifest: manifest(), target: isolated, actuals: [{ ...entries[0], sha256: "c".repeat(64) }, entries[1]] }),
    ).toThrow(/MANIFEST.DIGEST_MISMATCH/);
    expect(() => planRestore({ manifest: manifest(), target: isolated, actuals: [entries[1]] })).toThrow(
      /MANIFEST.ENTRY_MISSING/,
    );
  });

  it("refuse un manifeste sans dump de base", () => {
    const volumesOnly = buildBackupManifest({
      backupId: "volumes",
      createdAt: "2026-09-25T03:00:00.000Z",
      entries: [entries[1]],
    });
    expect(() => planRestore({ manifest: volumesOnly, target: isolated, actuals: [entries[1]] })).toThrow(
      /DATABASE_NOT_COVERED|aucun dump/,
    );
  });

  it("porte les empreintes d'export attendues et observées pour le contrôle post-restauration", () => {
    const plan = planRestore({
      manifest: manifest(),
      target: isolated,
      actuals: entries,
      expectedExportDigest: "d".repeat(64),
      actualExportDigest: "d".repeat(64),
    });
    expect(plan.verification.exportDigest).toBe("d".repeat(64));
    expect(plan.verification.exportDigestExpected).toBe("d".repeat(64));
    const drifted = planRestore({
      manifest: manifest(),
      target: isolated,
      actuals: entries,
      expectedExportDigest: "d".repeat(64),
      actualExportDigest: "e".repeat(64),
    });
    expect(drifted.verification.exportDigest).not.toBe(drifted.verification.exportDigestExpected);
    // Un écart d'empreinte n'interdit PAS la restauration : il se contrôle après.
    expect(drifted.executed).toBe(false);
  });

  it("refuse un identifiant de restauration contenant un mot de passe ou un hôte", () => {
    expect(() =>
      planRestore({ manifest: manifest(), target: { ...isolated, user: "audest@prod" }, actuals: entries }),
    ).toThrow(/Identifiant de restauration suspect/);
  });
});
