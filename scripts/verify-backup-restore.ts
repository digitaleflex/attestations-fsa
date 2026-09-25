/**
 * Vérification de restauration testable localement (#255).
 *
 * Le script NE RESTAURE RIEN. Il vérifie qu'une sauvegarde est authentique et
 * INTÉGRÉE (manifeste vs fichiers réels), puis produit le plan de restauration
 * vers une base ISOLÉE locale (`fsa_restore_*`). Le plan est refusée si la cible
 * n'est pas locale, si la base ne porte pas le préfixe d'isolation, ou si une
 * seule anomalie critique est détectée. Les commandes imprimées ne sont jamais
 * exécutées par ce script : elles le sont à la main, après relecture.
 *
 * Usage :
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/verify-backup-restore.ts \
 *     --manifest reports/backup-manifest.json \
 *     --dir /home/audest/backups/attestation-fsa/20260925-030000 \
 *     --host localhost --database fsa_restore_20260925 \
 *     --plan reports/restore-plan.json
 *
 * La procédure complète, testable sur une base isolée, est documentée dans
 * `docs/ops/fsa-reference-and-restore.md`.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { collectEntries, MANIFEST_ERRORS } from "./backup-manifest";
import { parseBackupManifest, type BackupManifest } from "../lib/backup/manifest";
import {
  planRestore,
  serializeRestorePlan,
  RestoreRefusedError,
  type RestorePlan,
  type RestoreTarget,
} from "../lib/backup/restore";

export interface RestoreCliOptions {
  manifestPath: string;
  dir: string;
  target: RestoreTarget;
  planPath: string | null;
  expectedExportDigest: string | null;
}

export function parseArgs(argv: string[]): RestoreCliOptions {
  let manifestPath: string | null = null;
  let dir: string | null = null;
  const target: RestoreTarget = { host: "localhost", database: "fsa_restore_local" };
  let planPath: string | null = null;
  let expectedExportDigest: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--manifest" || arg === "--dir" || arg === "--host" || arg === "--database" || arg === "--plan" || arg === "--user" || arg === "--port" || arg === "--export-digest") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${arg}`);
      if (arg === "--manifest") manifestPath = value;
      else if (arg === "--dir") dir = value;
      else if (arg === "--host") target.host = value;
      else if (arg === "--database") target.database = value;
      else if (arg === "--user") target.user = value;
      else if (arg === "--port") target.port = Number(value);
      else if (arg === "--plan") planPath = value;
      else expectedExportDigest = value;
      continue;
    }
    throw new Error(`Option inconnue: ${arg}`);
  }
  if (!manifestPath) throw new Error("--manifest est obligatoire");
  if (!dir) throw new Error("--dir est obligatoire");
  if (target.port !== undefined && !Number.isInteger(target.port)) throw new Error("--port invalide");
  return { manifestPath, dir, target, planPath, expectedExportDigest };
}

async function readManifest(path: string): Promise<BackupManifest> {
  const raw = await readFile(resolve(path), "utf8");
  return parseBackupManifest(JSON.parse(raw));
}

async function writeOut(path: string, content: string) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, { encoding: "utf8", flag: "w" });
}

export async function buildPlan(options: RestoreCliOptions): Promise<{ plan: RestorePlan; manifest: BackupManifest }> {
  const manifest = await readManifest(options.manifestPath);
  const actuals = await collectEntries(options.dir);
  const plan = planRestore({
    manifest,
    target: options.target,
    actuals,
    expectedExportDigest: options.expectedExportDigest,
  });
  return { plan, manifest };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  try {
    const { plan, manifest } = await buildPlan(options);
    if (options.planPath) await writeOut(options.planPath, serializeRestorePlan(plan));

    console.log(`Sauvegarde ${manifest.backupId} vérifiée : ${plan.verification.manifestEntries} artefact(s), ${plan.verification.totalBytes} o`);
    console.log(`Plan de restauration vers ${plan.target.host}/${plan.target.database} (base isolée) — AUCUNE commande exécutée`);
    for (const command of plan.commands) console.log(`  ${command}`);
    if (plan.verification.exportDigestExpected && plan.verification.exportDigest !== plan.verification.exportDigestExpected) {
      console.error("ÉCART : l'empreinte de l'export de référence diffère de celle attendue avant sauvegarde.");
      return 1;
    }
    return 0;
  } catch (error) {
    if (error instanceof RestoreRefusedError) {
      console.error(`[RESTORE_REFUSÉ] ${error.message}`);
      return 2;
    }
    if (error instanceof Error && (error.message === MANIFEST_ERRORS.empty || error.message === MANIFEST_ERRORS.missing)) {
      console.error(`[RESTORE_REFUSÉ] ${error.message}`);
      return 2;
    }
    throw error;
  }
}

const invokedDirectly = process.argv[1]?.endsWith("verify-backup-restore.ts");
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error("[VERIFY_RESTORE_ERROR]", error instanceof Error ? error.message : "erreur inconnue");
    process.exitCode = 1;
  });
}
