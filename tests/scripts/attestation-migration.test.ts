import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APPLY_REFUSAL_MESSAGE, parseArgs } from "../../scripts/classify-attestation-migration";

const root = resolve(__dirname, "../..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

describe("classify-attestation-migration (#259) — CLI et garde-fous", () => {
  it("force le dry-run et refuse --apply sans validation métier", () => {
    expect(parseArgs(["--dry-run", "--read-only", "--report", "tmp/plan.json"])).toEqual({
      mode: "dry-run",
      readOnly: true,
      reportPath: "tmp/plan.json",
      businessApproval: null,
    });
    expect(parseArgs(["--business-approval", "DA-2026-01"])).toMatchObject({ businessApproval: "DA-2026-01" });
    expect(() => parseArgs(["--apply"])).toThrow(APPLY_REFUSAL_MESSAGE);
    expect(() => parseArgs(["--apply", "--business-approval", "DA-2026-01"])).toThrow(/aucune validation métier explicite/);
  });

  it("refuse toute option de mutation inconnue", () => {
    expect(() => parseArgs(["--fix"])).toThrow(/Option inconnue/);
    expect(() => parseArgs(["--reseal"])).toThrow(/Option inconnue/);
    expect(() => parseArgs(["--report"])).toThrow(/Valeur manquante/);
  });

  it("n'expose aucune API d'écriture Prisma dans le script et le chargeur", () => {
    for (const file of ["scripts/classify-attestation-migration.ts", "lib/attestations/migration-snapshot.ts", "lib/attestations/migration.ts"]) {
      // La seule instruction brute autorisée est le verrou READ ONLY de la transaction.
      const source = read(file)
        .replaceAll("$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`)", "")
        .replaceAll("SET TRANSACTION READ ONLY", "");
      for (const forbidden of [".create({", ".update({", ".delete({", ".upsert({", "createMany", "updateMany", "deleteMany", "$queryRawUnsafe", "$executeRaw", "TRUNCATE", "DROP ", "ALTER TABLE", "INSERT INTO"]) {
        expect(source, `${file} ne doit pas contenir ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("charge le snapshot dans une transaction PostgreSQL READ ONLY", () => {
    expect(read("lib/attestations/migration-snapshot.ts")).toContain("SET TRANSACTION READ ONLY");
  });

  it("ncref / nscelle / ne génère aucun PDF dans le module de classification", () => {
    const source = read("lib/attestations/migration.ts");
    expect(source).not.toContain("generateOfficialPdf");
    expect(source).not.toContain("sealCertificate");
    expect(source).not.toContain("computeSealHash");
  });
});
