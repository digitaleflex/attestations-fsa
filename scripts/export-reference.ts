/**
 * Export de référence versionné et sûr (#255) — READ-ONLY strict.
 *
 * Produit un inventaire relisible des attestations, sessions, utilisateurs,
 * formations et de leurs relations, publiable comme artefact versionné : ni PII,
 * ni secret, ni URL signée, ni code FSA en clair. Deux exécutions sur la même
 * base donnent la MÊME empreinte (`digest`), ce qui prouve la reproductibilité.
 *
 * Usage :
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/export-reference.ts \
 *     --out reports/fsa-reference-export.json
 *   # empreinte seule, à comparer après restauration :
 *   pnpm exec ts-node --project tsconfig.seed.json scripts/export-reference.ts --print-digest
 *
 * Aucune option d'écriture n'existe. `--apply` est explicitement refusé.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  assertReferenceExportIsSafe,
  buildReferenceExport,
  referenceExportDigest,
  serializeReferenceExport,
  type ReferenceExport,
} from "../lib/attestations/reference-export";
import { loadReadOnlyReferenceSnapshot } from "../lib/attestations/reference-snapshot";

export const APPLY_REFUSAL_MESSAGE =
  "Refusé : --apply n'est pas supporté. L'export de référence est un inventaire en lecture seule ; " +
  "aucune écriture n'est implémentée et aucune ne le sera (#255 reste en lecture seule).";

export interface ExportCliOptions {
  mode: "read-only";
  outPath: string;
  digestPath: string | null;
  printDigest: boolean;
}

export function parseArgs(argv: string[]): ExportCliOptions {
  let outPath = "reports/fsa-reference-export.json";
  let digestPath: string | null = null;
  let printDigest = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--read-only" || arg === "--dry-run") continue;
    if (arg === "--apply") throw new Error(APPLY_REFUSAL_MESSAGE);
    if (arg === "--print-digest") {
      printDigest = true;
      continue;
    }
    if (arg === "--out" || arg === "--digest-out") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${arg}`);
      if (arg === "--out") outPath = value;
      else digestPath = value;
      continue;
    }
    throw new Error(`Option inconnue: ${arg}`);
  }
  return { mode: "read-only", outPath, digestPath, printDigest };
}

async function writeOut(path: string, content: string) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, { encoding: "utf8", flag: "w" });
}

export function digestDocument(exported: ReferenceExport, digest: string) {
  return `${JSON.stringify(
    {
      schemaVersion: exported.schemaVersion,
      generator: exported.generator,
      digest,
      attestations: exported.summary.attestations,
      uniqueCodes: exported.summary.uniqueCodes,
      sessions: exported.summary.sessions,
      users: exported.summary.users,
      formations: exported.summary.formations,
      brokenRelations: exported.summary.brokenRelations,
      invertedPeriods: exported.summary.invertedPeriods,
    },
    null,
    2,
  )}\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const prisma = new PrismaClient();
  try {
    const exported = assertReferenceExportIsSafe(
      buildReferenceExport(await loadReadOnlyReferenceSnapshot(prisma)),
    );
    const digest = referenceExportDigest(exported);

    if (options.printDigest) {
      console.log(digest);
      return 0;
    }

    await writeOut(options.outPath, serializeReferenceExport(exported));
    if (options.digestPath) await writeOut(options.digestPath, digestDocument(exported, digest));

    console.log(`Export de référence (sans PII) écrit dans ${options.outPath}`);
    console.log(`Empreinte reproductible: ${digest}`);
    console.log(
      `${exported.summary.attestations} attestations, ${exported.summary.uniqueCodes} codes uniques, ` +
        `${exported.summary.brokenRelations} relation(s) cassée(s), ${exported.summary.invertedPeriods} période(s) inversée(s)`,
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = process.argv[1]?.endsWith("export-reference.ts");
if (invokedDirectly) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error("[EXPORT_REFERENCE_ERROR]", error instanceof Error ? error.message : "erreur inconnue");
    process.exitCode = 1;
  });
}
