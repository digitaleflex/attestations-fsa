import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONSENT_TYPES,
  REQUIRED_CONSENTS,
  REVOCABLE_CONSENTS,
  buildRegistrationConsents,
} from "@/lib/consent-types";

/**
 * Contrat du clickwrap d'inscription (#153).
 *
 * Le risque concret couvert ici n'est pas théorique : `recordConsents`
 * (`lib/consent.ts`) rejette le LOT ENTIER en 422 dès qu'un type non révocable
 * arrive avec `granted: false`. Un formulaire qui enverrait les cases
 * décochées bloquerait donc la création de compte — exactement le « mal
 * d'inscription » constaté en production.
 */

describe("Consentements à l'inscription — clickwrap", () => {
  it("envoie toujours les trois acceptations contractuelles", () => {
    const lot = buildRegistrationConsents(false);
    const types = lot.map((c) => c.type);

    for (const requis of REQUIRED_CONSENTS) {
      expect(types).toContain(requis);
    }
  });

  it("n'envoie JAMAIS granted: false — sinon recordConsents rejette tout en 422", () => {
    for (const marketing of [false, true]) {
      const lot = buildRegistrationConsents(marketing);
      expect(lot.every((c) => c.granted === true)).toBe(true);
    }
  });

  it("omet MARKETING tant que la case n'est pas cochée", () => {
    const refus = buildRegistrationConsents(false);
    expect(refus.map((c) => c.type)).not.toContain("MARKETING");

    const accord = buildRegistrationConsents(true);
    expect(accord.map((c) => c.type)).toContain("MARKETING");
    expect(accord.find((c) => c.type === "MARKETING")?.granted).toBe(true);
  });

  it("ne propose pas THIRD_PARTY_TRANSFER : le transfert hors UE ne repose pas sur un consentement", () => {
    expect(buildRegistrationConsents(false).map((c) => c.type)).not.toContain(
      "THIRD_PARTY_TRANSFER",
    );
    expect(buildRegistrationConsents(true).map((c) => c.type)).not.toContain(
      "THIRD_PARTY_TRANSFER",
    );
  });

  it("ne produit aucun doublon", () => {
    const types = buildRegistrationConsents(true).map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("ne contient que des types connus de l'API", () => {
    for (const consent of buildRegistrationConsents(true)) {
      expect(CONSENT_TYPES).toContain(consent.type);
    }
  });

  it("MARKETING est le seul type révocable — donc le seul qui pouvait être une case", () => {
    expect([...REVOCABLE_CONSENTS]).toEqual(["MARKETING"]);
  });
});

describe("lib/consent-types.ts reste importable côté client", () => {
  it("n'importe AUCUNE dépendance runtime (Prisma interdirait le bundle navigateur)", () => {
    const source = readFileSync(join(process.cwd(), "lib/consent-types.ts"), "utf8");

    // Seul `import type` est toléré : il est effacé à la compilation.
    const runtimeImports = [...source.matchAll(/^import\s+(?!type\b)(.+)$/gm)];
    expect(runtimeImports).toHaveLength(0);
  });
});
