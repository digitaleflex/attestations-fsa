/**
 * Plan de migration des attestations historiques FSA (#259) — DRY-RUN strict.
 *
 * Ce script est un OUTIL D'INVENTAIRE, pas un outil de migration :
 *  - il ne modifie, ne supprime et ne renumérote aucun code FSA ;
 *  - il ne génère aucun PDF et ne rescelle aucune ligne historique ;
 *  - `--apply` est refusé : aucun chemin d'écriture n'est implémenté, et rien
 *    ne le sera sans validation métier explicite tracée dans le rapport.
 *
 * Usage :
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/classify-attestation-migration.ts \
 *     --dry-run --report reports/fsa-migration-plan.json
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { classifySnapshot, redactMigrationReport, type MigrationReport } from "../lib/attestations/migration";
import { loadReadOnlySnapshot } from "../lib/attestations/migration-snapshot";

export const APPLY_REFUSAL_MESSAGE =
  "Refusé : --apply n'est pas supporté. Aucun chemin d'écriture n'existe dans cet outil " +
  "(#259 reste en dry-run) et aucune validation métier explicite n'est enregistrée. " +
  "Prérequis pour toute écriture : revue du plan, décision métier tracée, puis script d'écriture dédié.";

export interface CliOptions {
  mode: "dry-run";
  readOnly: true;
  reportPath: string;
  businessApproval: string | null;
}

export function parseArgs(argv: string[]): CliOptions {
  let reportPath = "reports/fsa-migration-plan.json";
  let businessApproval: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "--read-only") continue;
    if (arg === "--apply") throw new Error(APPLY_REFUSAL_MESSAGE);
    if (arg === "--business-approval") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${arg}`);
      businessApproval = value;
      continue;
    }
    if (arg === "--report") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${arg}`);
      reportPath = value;
      continue;
    }
    throw new Error(`Option inconnue: ${arg}`);
  }
  return { mode: "dry-run", readOnly: true, reportPath, businessApproval };
}

async function writeReport(path: string, report: MigrationReport) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(redactMigrationReport(report), null, 2)}\n`, { encoding: "utf8", flag: "w" });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const prisma = new PrismaClient();
  try {
    const report = classifySnapshot(await loadReadOnlySnapshot(prisma));
    if (options.businessApproval) {
      report.findings.push({
        severity: "WARNING",
        check: "MIGRATION.approval.registered",
        entity: "run",
        detail: "référence de validation métier fournie : elle n'autorise aucune écriture (dry-run maintenu)",
      });
    }
    await writeReport(options.reportPath, report);
    console.log(`Plan de migration (dry-run) écrit dans ${options.reportPath}`);
    console.log(`${report.summary.attestations} attestations classées, ${report.summary.blockingAnomalies} anomalie(s) bloquante(s), ${report.summary.reviewRequired} en revue`);
    console.log(JSON.stringify(report.summary.byMigrationStatus));
    return report.summary.blockingAnomalies > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = process.argv[1]?.endsWith("classify-attestation-migration.ts");
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error("[MIGRATION_PLAN_ERROR]", error instanceof Error ? error.message : "erreur inconnue");
    process.exitCode = 1;
  });
}
