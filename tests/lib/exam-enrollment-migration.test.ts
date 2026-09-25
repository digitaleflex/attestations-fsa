// #256 — garantie FORMELLE que l'ajout des champs de suivi de
// `ExamEnrollment` reste additif, idempotent et compatible avec les clés
// `TEXT` historiques (design M9, §2). Ce test lit les fichiers versionnés :
// il échoue si quelqu'un introduit un DROP, un backfill ou un enum Prisma.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

const MIGRATION_PATH = join(
  ROOT,
  "prisma",
  "migrations",
  "20260925_exam_enrollment_tracking",
  "migration.sql",
);
const SCHEMA_PATH = join(ROOT, "prisma", "schema.prisma");
const CREATION_MIGRATION = join(
  ROOT,
  "prisma",
  "migrations",
  "20260925_exam_enrollment",
  "migration.sql",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

/** Retire les commentaires SQL (`--` …) pour ne raisonner que sur les DDL. */
function ddl(sql: string) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

const migration = ddl(read(MIGRATION_PATH));
const schema = read(SCHEMA_PATH);

describe("migration ExamEnrollment — additif et idempotent (#256)", () => {
  it("ne contient aucune opération destructive", () => {
    for (const forbidden of [
      "DROP ",
      "DELETE ",
      "TRUNCATE",
      "ALTER COLUMN",
      "SET NOT NULL",
      "CREATE TYPE",
      "RENAME ",
      "UPDATE ",
    ]) {
      expect(migration).not.toContain(forbidden);
    }
  });

  it("n'ajoute que des colonnes avec IF NOT EXISTS (ré-exécutable)", () => {
    const addColumns = migration.match(/ADD COLUMN IF NOT EXISTS/g) ?? [];
    expect(addColumns.length).toBe(8);
    // Toute instruction d'écriture de schéma est conditionnelle.
    for (const line of migration.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("ADD COLUMN")) continue;
      expect(trimmed).toContain("IF NOT EXISTS");
    }
    expect(migration).toContain("CREATE INDEX IF NOT EXISTS");
  });

  it("n'utilise que des types TEXT / TIMESTAMP (compatibilité clés TEXT)", () => {
    const columnType = /ADD COLUMN IF NOT EXISTS "(\w+)" ([A-Z]+(?:\(\d+\))?)/g;
    const types = [...migration.matchAll(columnType)].map((match) => match[2]);
    expect(types).toHaveLength(8);
    for (const type of types) {
      expect(["TEXT", "TIMESTAMP(3)"]).toContain(type);
    }
    // Aucun type maison : les lignes historiques ne sont pas converties.
    expect(migration).not.toMatch(/ENUM|UUID|VARCHAR|JSONB/);
  });

  it("ne touche pas à l'unicité (userId, examId) ni aux sessions", () => {
    expect(migration).not.toContain("ExamEnrollment_userId_examId_key");
    expect(migration).not.toContain("ExamSession");
    expect(migration).not.toContain("User\"");
  });

  it("reprend la valeur par défaut ACTIVE, qui reproduit l'éligibilité d'avant migration", () => {
    // Une inscription existante reste donc ACTIVE : le défaut ne « ferme »
    // personne et ne nécessite aucun backfill.
    expect(migration).toContain(`"status" TEXT NOT NULL DEFAULT 'ACTIVE'`);
  });
});

describe("schéma Prisma — suivi de l'inscription (#256)", () => {
  const model = (() => {
    const start = schema.indexOf("model ExamEnrollment {");
    const end = schema.indexOf("model InternshipRequest {", start);
    return schema.slice(start, end);
  })();

  it("déclare les champs de suivi attendus", () => {
    for (const field of [
      "status",
      "source",
      "grantedById",
      "note",
      "revokedAt",
      "revokedById",
      "revokeReason",
      "updatedAt",
    ]) {
      expect(model).toContain(field);
    }
  });

  it("garde status/source en String (TEXT) et non en enum Prisma", () => {
    expect(model).toMatch(/status\s+String\s+@default\("ACTIVE"\)/);
    expect(model).toMatch(/source\s+String\s+@default\("ADMIN_ASSIGNMENT"\)/);
    // Aucun enum d'inscription ne doit exister dans le schéma.
    expect(schema).not.toMatch(/enum\s+ExamEnrollmentStatus/);
    expect(schema).not.toMatch(/enum\s+Enrollment/);
  });

  it("conserve la clé unique (userId, examId) qui rend l'inscription idempotente", () => {
    expect(model).toContain("@@unique([userId, examId])");
  });

  it("indexe le statut pour le filtrage des listes candidat", () => {
    expect(model).toContain("@@index([status])");
  });
});

describe("migration de création ExamEnrollment — historique", () => {
  it("reste en TEXT pour userId/examId (aucune conversion de clé)", () => {
    const creation = ddl(read(CREATION_MIGRATION));
    expect(creation).toContain('"userId" TEXT NOT NULL');
    expect(creation).toContain('"examId" TEXT NOT NULL');
  });
});
