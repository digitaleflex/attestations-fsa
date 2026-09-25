/**
 * Manifeste de sauvegarde (#255) — construction locale, SANS base de données.
 *
 * Le script ne se connecte à rien : il décrit les fichiers réellement présents
 * dans un répertoire de sauvegarde (`scripts/vps-pre-deploy-backup.sh` ou
 * `pg_dump -Fc` local), calcule leur empreinte SHA-256 et leur taille, et écrit
 * un manifeste versionné réutilisable à la vérification comme à la restauration.
 *
 * Usage :
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/backup-manifest.ts \
 *     --dir /home/audest/backups/attestation-fsa/db-backup-20260925-030000.dump \
 *     --out reports/backup-manifest.json
 *
 * Aucun secret n'est écrit : seuls des NOMS de fichiers relatifs, des tailles et
 * des empreintes quittent ce script. Un chemin absolu, une URL ou un nom de
 * fichier suspect fait échouer la construction.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalJson, sha256Hex } from "../lib/backup/canonical";
import {
  BACKUP_MANIFEST_SCHEMA_VERSION,
  assertManifestIsSafe,
  buildBackupManifest,
  type BackupEntryKind,
  type BackupManifestEntry,
} from "../lib/backup/manifest";

export const MANIFEST_ERRORS = {
  empty: "Répertoire de sauvegarde vide : aucun artefactil à décrire.",
  missing: "Chemin de sauvegarde introuvable.",
} as const;

export interface ManifestCliOptions {
  dir: string;
  outPath: string;
  backupId: string | null;
}

export function parseArgs(argv: string[]): ManifestCliOptions {
  let dir: string | null = null;
  let outPath = "reports/backup-manifest.json";
  let backupId: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir" || arg === "--out" || arg === "--backup-id") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${arg}`);
      if (arg === "--dir") dir = value;
      else if (arg === "--out") outPath = value;
      else backupId = value;
      continue;
    }
    throw new Error(`Option inconnue: ${arg}`);
  }
  if (!dir) throw new Error("--dir est obligatoire");
  return { dir, outPath, backupId };
}

/** Empreinte SHA-256 d'un fichier, lue par flux (aucun dump chargé en mémoire). */
export async function fileDigest(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise());
  });
  return hash.digest("hex");
}

function kindOf(name: string): BackupEntryKind {
  if (name.endsWith(".dump") || name.endsWith(".sql") || name.endsWith(".backup")) return "database";
  return "volume";
}

export async function collectEntries(dir: string): Promise<BackupManifestEntry[]> {
  const info = await stat(dir).catch(() => null);
  if (!info) throw new Error(MANIFEST_ERRORS.missing);

  const files = info.isDirectory()
    ? (await readdir(dir, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => join(dir, entry.name))
    : [dir];
  if (files.length === 0) throw new Error(MANIFEST_ERRORS.empty);

  const entries: BackupManifestEntry[] = [];
  for (const file of files.sort()) {
    // Un nom de fichier suffit : le chemin absolu ne sort jamais d'ici.
    const name = basename(file);
    if (name.endsWith(".sha256") || name.endsWith(".age")) continue;
    const fileInfo = await stat(file);
    entries.push({ kind: kindOf(name), name, bytes: fileInfo.size, sha256: await fileDigest(file) });
  }
  if (entries.length === 0) throw new Error(MANIFEST_ERRORS.empty);
  return entries;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const entries = await collectEntries(options.dir);
  const derivedId = basename(resolve(options.dir)).replace(/\.[^.]+$/, "");
  const backupId = options.backupId ?? (derivedId || "sauvegarde");
  const manifest = assertManifestIsSafe(
    buildBackupManifest({ backupId, createdAt: new Date().toISOString(), entries }),
  );

  const absolute = resolve(options.outPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "w" });

  console.log(`Manifeste (version ${BACKUP_MANIFEST_SCHEMA_VERSION}) écrit dans ${options.outPath}`);
  console.log(`Sauvegarde: ${manifest.backupId} — ${manifest.entries.length} artefact(s), ${manifest.totalBytes} o`);
  console.log(`Couverture: base=${manifest.coverage.database ? "oui" : "NON"}, volumes=${manifest.coverage.volumes.join(",") || "aucun"}`);
  console.log(`Empreinte du manifeste: ${manifest.digest}`);
  console.log(`Empreinte canonique: ${sha256Hex(canonicalJson(manifest.entries))}`);
  return manifest.coverage.database ? 0 : 1;
}

const invokedDirectly = process.argv[1]?.endsWith("backup-manifest.ts");
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error("[BACKUP_MANIFEST_ERROR]", error instanceof Error ? error.message : "erreur inconnue");
    process.exitCode = 1;
  });
}
