import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APPLY_REFUSAL_MESSAGE, digestDocument, parseArgs } from "../../scripts/export-reference";
import { buildReferenceExport, referenceExportDigest } from "../../lib/attestations/reference-export";

const root = resolve(__dirname, "../..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("export de référence — CLI et garde-fous (#255)", () => {
  it("force le read-only et refuse --apply", () => {
    expect(parseArgs(["--read-only", "--out", "tmp/export.json"])).toEqual({
      mode: "read-only",
      outPath: "tmp/export.json",
      digestPath: null,
      printDigest: false,
    });
    expect(parseArgs(["--digest-out", "tmp/digest.json", "--print-digest"])).toMatchObject({
      digestPath: "tmp/digest.json",
      printDigest: true,
    });
    expect(() => parseArgs(["--apply"])).toThrow(APPLY_REFUSAL_MESSAGE);
    expect(() => parseArgs(["--fix"])).toThrow(/Option inconnue/);
    expect(() => parseArgs(["--out"])).toThrow(/Valeur manquante/);
  });

  it("n'expose aucune API d'écriture Prisma dans le script ni dans son chargeur", () => {
    for (const file of ["scripts/export-reference.ts", "lib/attestations/reference-snapshot.ts", "lib/attestations/reference-export.ts"]) {
      // Seule instruction brute autorisée : le verrou READ ONLY de la transaction.
      const source = read(file)
        .replaceAll("$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`)", "")
        .replaceAll("SET TRANSACTION READ ONLY", "");
      for (const forbidden of [".create({", ".update({", ".delete({", ".upsert({", "createMany", "updateMany", "deleteMany", "$queryRawUnsafe", "$executeRaw", "TRUNCATE", "DROP ", "ALTER TABLE", "INSERT INTO"]) {
        expect(source, `${file} ne doit pas contenir ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("charge le snapshot dans une transaction PostgreSQL READ ONLY", () => {
    expect(read("lib/attestations/reference-snapshot.ts")).toContain("SET TRANSACTION READ ONLY");
  });

  it("ne sélectionne jamais une colonne de PII", () => {
    const source = read("lib/attestations/reference-snapshot.ts");
    // Seule exception tolérée : la colonne `email`, transformée en booléen
    // immédiatement et jamais transmise à l'export.
    const columns = /const ATTESTATION_COLUMNS = \[([\s\S]*?)\];/.exec(source)?.[1] ?? "";
    for (const pii of ["fullName", "birthDate", "birthPlace", "phone", "address", "gender", "location", "instructor"]) {
      expect(columns, `Attestation.${pii} ne doit pas être sélectionnée`).not.toContain(pii);
    }
    expect(source).toContain("hasEmail");
  });

  it("écrit un document d'empreinte minimal, sans donnée nominative", async () => {
    const exported = buildReferenceExport(
      {
        attestations: [],
        sessions: [],
        users: [],
        formations: [],
      },
      new Date("2026-09-25T12:00:00.000Z"),
    );
    const document = JSON.parse(digestDocument(exported, referenceExportDigest(exported)));
    expect(Object.keys(document)).toEqual([
      "schemaVersion",
      "generator",
      "digest",
      "attestations",
      "uniqueCodes",
      "sessions",
      "users",
      "formations",
      "brokenRelations",
      "invertedPeriods",
    ]);
    expect(document.digest).toHaveLength(64);
  });

  it("produit un artefact publiable relisible dans un répertoire temporaire", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsa-export-"));
    const target = join(dir, "export.json");
    const exported = buildReferenceExport({ attestations: [], sessions: [], users: [], formations: [] });
    await writeFile(target, `${JSON.stringify(exported, null, 2)}\n`, "utf8");
    const reread = JSON.parse(await readFile(target, "utf8"));
    expect(referenceExportDigest(reread as never)).toBe(referenceExportDigest(exported));
  });
});
