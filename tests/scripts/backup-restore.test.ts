import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectEntries, MANIFEST_ERRORS, parseArgs as parseManifestArgs } from "../../scripts/backup-manifest";
import { buildPlan, parseArgs as parseRestoreArgs } from "../../scripts/verify-backup-restore";
import { buildBackupManifest, parseBackupManifest, verifyBackupManifest } from "../../lib/backup/manifest";
import { RestoreRefusedError } from "../../lib/backup/restore";

/** Banc d'essai SANS base de données : la procédure doit être testable partout. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "fsa-backup-"));
  const save = await mkdtemp(join(tmpdir(), "fsa-backup-data-"));
  await writeFile(join(save, "db-backup-20260925-030000.dump"), "PGDUMP-FACTICE", "utf8");
  await writeFile(join(save, "uploads-public-20260925-030000.tar.gz"), "ARCHIVE-FACTICE", "utf8");
  const manifestPath = join(dir, "backup-manifest.json");
  const planPath = join(dir, "restore-plan.json");
  return { dir, save, manifestPath, planPath };
}

describe("manifeste de sauvegarde — bout en bout local (#255)", () => {
  it("exige un répertoire et refuse les options inconnues", () => {
    expect(() => parseManifestArgs([])).toThrow(/--dir est obligatoire/);
    expect(parseManifestArgs(["--dir", "/tmp/x", "--out", "tmp/m.json"])).toEqual({
      dir: "/tmp/x",
      outPath: "tmp/m.json",
      backupId: null,
    });
    expect(() => parseManifestArgs(["--dir", "/tmp/x", "--prod"])).toThrow(/Option inconnue/);
  });

  it("décrit les fichiers réellement présents, sans chemin absolu", async () => {
    const { save } = await fixture();
    const entries = await collectEntries(save);
    expect(entries.map((entry) => entry.name).sort()).toEqual([
      "db-backup-20260925-030000.dump",
      "uploads-public-20260925-030000.tar.gz",
    ]);
    expect(entries.every((entry) => !entry.name.includes("/"))).toBe(true);
    expect(entries.find((entry) => entry.kind === "database")!.bytes).toBe("PGDUMP-FACTICE".length);
    expect(entries.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256))).toBe(true);
  });

  it("ignore les sidecars de checksum et les archives chiffrées", async () => {
    const { save } = await fixture();
    await writeFile(join(save, "db-backup-20260925-030000.dump.sha256"), "abc  db-backup-20260925-030000.dump", "utf8");
    await writeFile(join(save, "db-backup-20260925-030000.dump.age"), "chiffre", "utf8");
    const names = (await collectEntries(save)).map((entry) => entry.name);
    expect(names).not.toContain("db-backup-20260925-030000.dump.sha256");
    expect(names).not.toContain("db-backup-20260925-030000.dump.age");
  });

  it("échoue explicitement sur un répertoire vide ou absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsa-empty-"));
    await expect(collectEntries(dir)).rejects.toThrow(MANIFEST_ERRORS.empty);
    await expect(collectEntries(join(dir, "absent"))).rejects.toThrow(MANIFEST_ERRORS.missing);
  });
});

describe("vérification de restauration — bout en bout local (#255)", () => {
  it("valide ses options et impose manifeste + répertoire", () => {
    expect(() => parseRestoreArgs([])).toThrow(/--manifest est obligatoire/);
    expect(() => parseRestoreArgs(["--manifest", "m.json"])).toThrow(/--dir est obligatoire/);
    const options = parseRestoreArgs([
      "--manifest", "m.json", "--dir", "sauvegarde", "--host", "localhost",
      "--database", "fsa_restore_20260925", "--port", "5432", "--user", "audest",
      "--plan", "tmp/plan.json", "--export-digest", "a".repeat(64),
    ]);
    expect(options.target).toEqual({ host: "localhost", database: "fsa_restore_20260925", user: "audest", port: 5432 });
    expect(options.expectedExportDigest).toHaveLength(64);
    expect(() => parseRestoreArgs(["--manifest", "m.json", "--dir", "s", "--force"])).toThrow(/Option inconnue/);
  });

  it("construit un plan depuis un manifeste écrit sur disque", async () => {
    const { save, manifestPath, planPath } = await fixture();
    const entries = await collectEntries(save);
    const manifest = buildBackupManifest({
      backupId: "db-backup-20260925-030000",
      createdAt: "2026-09-25T03:00:00.000Z",
      entries,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const { plan } = await buildPlan({
      manifestPath,
      dir: save,
      target: { host: "localhost", database: "fsa_restore_20260925" },
      planPath,
      expectedExportDigest: null,
    });
    expect(plan.verification.findings.filter((finding) => finding.severity === "CRITICAL")).toHaveLength(0);
    expect(plan.verification.manifestEntries).toBe(2);
    expect(plan.executed).toBe(false);
    expect(plan.commands.join("\n")).toContain("pg_restore");
    // `buildPlan` ne dérive aucun fichier : l'écriture du plan est un choix du
    // CLI, et un refus ne laisse jamais d'artefact derrière lui.
    await expect(stat(planPath)).rejects.toThrow();
  });

  it("refuse un manifeste altéré et une cible de production, sans rien écrire", async () => {
    const { save, manifestPath, planPath } = await fixture();
    const entries = await collectEntries(save);
    const manifest = buildBackupManifest({
      backupId: "db-backup-20260925-030000",
      createdAt: "2026-09-25T03:00:00.000Z",
      entries,
    });
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, totalBytes: 1 }, null, 2)}\n`, "utf8");
    expect(() => parseBackupManifest({ ...manifest, totalBytes: 1 })).toThrow(/incohérent/);

    // Un manifeste valide mais modifié APRÈS écriture (signature incohérente)
    // est rejeté avant toute planification.
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, entries: [{ ...entries[0], bytes: 1 }, entries[1]] }, null, 2)}\n`, "utf8");
    await expect(
      buildPlan({
        manifestPath,
        dir: save,
        target: { host: "localhost", database: "fsa_restore_20260925" },
        planPath,
        expectedExportDigest: null,
      }),
    ).rejects.toThrow();

    // Production : refus immédiat.
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await expect(
      buildPlan({
        manifestPath,
        dir: save,
        target: { host: "db.production.internal", database: "attestation_fsa" },
        planPath,
        expectedExportDigest: null,
      }),
    ).rejects.toThrow(RestoreRefusedError);
    await expect(stat(planPath)).rejects.toThrow();
  });

  it("signale un artefact altéré entre la sauvegarde et la vérification", async () => {
    const { save, manifestPath } = await fixture();
    const entries = await collectEntries(save);
    const manifest = buildBackupManifest({
      backupId: "db-backup-20260925-030000",
      createdAt: "2026-09-25T03:00:00.000Z",
      entries,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    // Le dump est modifié APRÈS la construction du manifeste.
    await writeFile(join(save, "db-backup-20260925-030000.dump"), "PGDUMP-MODIFIE", "utf8");

    expect(verifyBackupManifest(manifest, await collectEntries(save)).map((f) => f.check)).toContain(
      "MANIFEST.DIGEST_MISMATCH",
    );
    await expect(
      buildPlan({
        manifestPath,
        dir: save,
        target: { host: "localhost", database: "fsa_restore_20260925" },
        planPath: null,
        expectedExportDigest: null,
      }),
    ).rejects.toThrow(/MANIFEST.DIGEST_MISMATCH/);
  });
});
