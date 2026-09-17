/**
 * tests/scripts/dump-models.test.ts
 *
 * Anti-regression test (issue #215): verifies that every Prisma model
 * referenced by backup/restore scripts actually exists in the schema.
 *
 * When a developer removes a model from prisma/schema.prisma but forgets
 * to update the dump/import scripts, this test fails instead of silently
 * breaking the backup at runtime.
 *
 * No database connection required — reads schema.prisma and script files only.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** Convert camelCase Prisma client accessor to PascalCase model name */
function camelToPascal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/* 1. Extract model names from prisma/schema.prisma (PascalCase)        */
/* ------------------------------------------------------------------ */
function getSchemaModels(): Set<string> {
  const schema = fs.readFileSync(
    path.join(ROOT, "prisma/schema.prisma"),
    "utf8",
  );
  const models = new Set<string>();
  for (const line of schema.split("\n")) {
    const match = line.match(/^model\s+(\w+)\s*\{/);
    if (match) models.add(match[1]);
  }
  return models;
}

/* ------------------------------------------------------------------ */
/* 2. Extract model names referenced in scripts/db-dump.ts              */
/*    Returns PascalCase names (converted from camelCase accessor)      */
/* ------------------------------------------------------------------ */
function getDumpScriptModels(): string[] {
  const src = fs.readFileSync(
    path.join(ROOT, "scripts/db-dump.ts"),
    "utf8",
  );
  // Match prisma.<accessor>.findMany() patterns, convert to PascalCase
  const re = /prisma\.(\w+)\.findMany/g;
  const models: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    models.push(camelToPascal(m[1]));
  }
  return models;
}

/* ------------------------------------------------------------------ */
/* 3. Extract table names referenced in import-json-to-postgres.sh      */
/*    Already PascalCase in the shell script                            */
/* ------------------------------------------------------------------ */
function getImportScriptTables(): string[] {
  const src = fs.readFileSync(
    path.join(ROOT, "scripts/import-json-to-postgres.sh"),
    "utf8",
  );
  // Match table: "TableName" patterns
  const re = /table:\s*"(\w+)"/g;
  const tables: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    tables.push(m[1]);
  }
  return tables;
}

/* ------------------------------------------------------------------ */
/* 4. Extract User fields referenced in scripts/db-dump.ts              */
/* ------------------------------------------------------------------ */
function getDumpUserFields(): string[] {
  const src = fs.readFileSync(
    path.join(ROOT, "scripts/db-dump.ts"),
    "utf8",
  );
  // Find the prisma.user.findMany select block
  const selectMatch = src.match(
    /prisma\.user\.findMany\(\{[\s\S]*?select:\s*\{([\s\S]*?)\}/,
  );
  if (!selectMatch) return [];
  const selectBlock = selectMatch[1];
  // Match field: true patterns
  const re = /(\w+):\s*true/g;
  const fields: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(selectBlock)) !== null) {
    fields.push(m[1]);
  }
  return fields;
}

/* ------------------------------------------------------------------ */
/* 5. Extract User fields from prisma/schema.prisma                     */
/* ------------------------------------------------------------------ */
function getSchemaUserFields(): Set<string> {
  const schema = fs.readFileSync(
    path.join(ROOT, "prisma/schema.prisma"),
    "utf8",
  );
  // Find the User model block
  const userMatch = schema.match(
    /model User \{([\s\S]*?)(?=\nmodel |\nenum |$)/,
  );
  if (!userMatch) return new Set();
  const block = userMatch[1];
  const fields = new Set<string>();
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    // Skip empty, comments, relations, directives
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("@") ||
      trimmed.includes("[]")
    )
      continue;
    const fieldMatch = trimmed.match(/^(\w+)\s/);
    if (fieldMatch) fields.add(fieldMatch[1]);
  }
  return fields;
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

describe("Dump/import scripts reference only valid Prisma models", () => {
  const schemaModels = getSchemaModels();

  it("db-dump.ts references only models that exist in schema.prisma", () => {
    const dumpModels = getDumpScriptModels();
    const invalid = dumpModels.filter((m) => !schemaModels.has(m));

    expect(invalid).toEqual([]);
    // Ensure we actually checked something
    expect(dumpModels.length).toBeGreaterThan(0);
  });

  it("import-json-to-postgres.sh references only tables that exist in schema.prisma", () => {
    const importTables = getImportScriptTables();
    const invalid = importTables.filter((t) => !schemaModels.has(t));

    expect(invalid).toEqual([]);
    // Ensure we actually checked something
    expect(importTables.length).toBeGreaterThan(0);
  });
});

describe("Dump script User fields match schema", () => {
  it("db-dump.ts selects only fields that exist on the User model", () => {
    const schemaUserFields = getSchemaUserFields();
    const dumpUserFields = getDumpUserFields();

    const invalid = dumpUserFields.filter((f) => !schemaUserFields.has(f));

    expect(invalid).toEqual([]);
    expect(dumpUserFields.length).toBeGreaterThan(0);
  });
});

describe("Script coverage sanity", () => {
  it("db-dump.ts covers at least 15 models (no accidental mass removal)", () => {
    const dumpModels = getDumpScriptModels();
    expect(dumpModels.length).toBeGreaterThanOrEqual(15);
  });

  it("import-json-to-postgres.sh covers at least 15 tables", () => {
    const importTables = getImportScriptTables();
    expect(importTables.length).toBeGreaterThanOrEqual(15);
  });
});
