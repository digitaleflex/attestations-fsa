import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const qrSources = [
  "app/(user)/attestations/page.tsx",
  "app/(user)/attestations/[id]/page.tsx",
  "app/admin/attestations/[id]/page.tsx",
];

describe("liens de vérification des attestations", () => {
  it.each(qrSources)("cible la route publique par query string dans %s", (source) => {
    const contents = readFileSync(resolve(process.cwd(), source), "utf8");

    expect(contents).toContain("/verifier?code=${encodeURIComponent(");
    expect(contents).not.toContain("/verifier/${");
  });
});
