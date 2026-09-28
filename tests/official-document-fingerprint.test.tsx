// tests/official-document-fingerprint.test.tsx
// #281 — L'empreinte publique `FP:` se rattache au CODE FSA, jamais à un
// identifiant interne de base.
//
// Rappel du défaut : `OfficialDocument` alimentait `AttestationWatermark` avec
// `attestationId={data.id}` et `userId={data.id}`. L'empreinte dépendait donc du
// cuid `Attestation.id`, et ce cuid était rendu PUBLIQUEMENT de deux façons :
//  - le pied du document affichait `ID: <8 premiers caractères du cuid>` ;
//  - le filigrane posait `data-aid` / `data-uid` dans le DOM, et son `FP:`
//    affiché dérivait de ce même cuid.
// Or `/api/verifier` ne publie aucun identifiant interne : le vérificateur
// public pouvait donc lire dans le document rendu une valeur que l'API refuse
// de lui donner. Retirer `id` de la réponse aurait cassé le type du composant.
//
// Après : l'ancre de l'empreinte est `code` + `generatedAt`, deux données déjà
// publiques et affichées sur le document. `data.id` n'est plus lu nulle part.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import {
  AttestationWatermark,
  computeFingerprint,
  fingerprintSource,
  verifyWatermark,
} from "@/components/AttestationWatermark";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OFFICIAL_DOCUMENT = read(path.join("components", "OfficialDocument.tsx"));
const WATERMARK = read(path.join("components", "AttestationWatermark.tsx"));
const VERIFIER_ROUTE = read(path.join("app", "api", "verifier", "route.ts"));
const VERIFIER_PAGE = read(path.join("app", "(public)", "verifier", "page.tsx"));
const ADMIN_DETAIL = read(path.join("app", "admin", "attestations", "[id]", "page.tsx"));
const USER_DETAIL = read(path.join("app", "(user)", "attestations", "[id]", "page.tsx"));

const CODE = "FSA-2026-M01-00042-f0f9a";
const GENERATED_AT = "2026-01-02T00:00:00.000Z";

describe("Chaîne d'empreinte — dérivée du code public", () => {
  it("la source de l'empreinte est exactement le code et l'instant d'émission", () => {
    // Chaîne figée, sans identifiant interne : c'est l'invariant central.
    expect(fingerprintSource(CODE, GENERATED_AT)).toBe(`${CODE}-${GENERATED_AT}`);
  });

  it("l'empreinte est déterministe", () => {
    expect(computeFingerprint(CODE, GENERATED_AT)).toBe(
      computeFingerprint(CODE, GENERATED_AT),
    );
  });

  it("deux codes différents ne donnent jamais la même empreinte", () => {
    expect(computeFingerprint(CODE, GENERATED_AT)).not.toBe(
      computeFingerprint("FSA-2026-M01-00043-0a1b2", GENERATED_AT),
    );
  });

  it("l'instant d'émission discrimine deux rendus du même code", () => {
    expect(computeFingerprint(CODE, GENERATED_AT)).not.toBe(
      computeFingerprint(CODE, "2027-06-30T12:00:00.000Z"),
    );
  });

  it("l'empreinte affichée ne contient ni le code en clair ni son suffixe", () => {
    // `FP:` est une empreinte courte affichée en clair : elle ne doit pas
    // redoubler l'information du code, déjà imprimé juste au-dessus.
    const fingerprint = computeFingerprint(CODE, GENERATED_AT);
    expect(fingerprint).not.toContain(CODE);
    expect(fingerprint).not.toContain("f0f9a");
  });
});

describe("verifyWatermark — même chaîne que le composant", () => {
  it("accepte l'empreinte produite par computeFingerprint", () => {
    expect(
      verifyWatermark({
        fingerprint: computeFingerprint(CODE, GENERATED_AT),
        code: CODE,
        generatedAt: GENERATED_AT,
      }),
    ).toEqual({ valid: true });
  });

  it("refuse une empreinte calculée sur un autre code", () => {
    // C'est le test qui compte : il prouve que l'empreinte est ADOSSÉE au code
    // et qu'un code substitué ne passe pas la vérification.
    const forged = computeFingerprint("FSA-2026-M01-00043-0a1b2", GENERATED_AT);
    const result = verifyWatermark({
      fingerprint: forged,
      code: CODE,
      generatedAt: GENERATED_AT,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/mismatch/i);
  });

  it("refuse une empreinte absente", () => {
    expect(
      verifyWatermark({ code: CODE, generatedAt: GENERATED_AT }).valid,
    ).toBe(false);
  });
});

describe("Rendu réel — aucun identifiant interne dans le HTML", () => {
  it("le filigrane ne rend rien avant le calcul de l'empreinte", () => {
    // `useEffect` ne tourne pas en rendu statique : avant hydratation, le
    // composant ne doit produire AUCUN marqueur, et surtout aucun identifiant.
    const html = renderToStaticMarkup(
      <AttestationWatermark code={CODE} generatedAt={GENERATED_AT} />,
    );

    expect(html).toBe("");
  });
});

describe("Invariants de source — l'identifiant interne a disparu du document", () => {
  it("OfficialDocument ne lit plus data.id", () => {
    expect(OFFICIAL_DOCUMENT).not.toContain("data.id");
    expect(OFFICIAL_DOCUMENT).not.toMatch(/attestationId=/);
    expect(OFFICIAL_DOCUMENT).not.toMatch(/userId=/);
  });

  it("le pied du document n'affiche plus le cuid", () => {
    // `ID: <cuid>` était la fuite publique la plus lisible.
    expect(OFFICIAL_DOCUMENT).not.toMatch(/ID: \{data/);
    // Le code FSA reste affiché : c'est l'ancre publique de remplacement.
    expect(OFFICIAL_DOCUMENT).toMatch(/CODE: \{data\.code\}/);
  });

  it("le filigrane ne transportation plus d'identifiant interne", () => {
    // Les attributs DOM sont lisibles par n'importe quel tiers.
    expect(WATERMARK).not.toMatch(/data-aid/);
    expect(WATERMARK).not.toMatch(/data-uid/);
    expect(WATERMARK).not.toMatch(/data-attestation-id/);
    expect(WATERMARK).not.toMatch(/data-user-id/);
    // L'ancre publique prend leur place.
    expect(WATERMARK).toMatch(/data-fp=\{fingerprint\}/);
    expect(WATERMARK).toMatch(/data-code=\{normalizedCode\}/);
  });

  it("le filigrane se garde de l'affichage d'une empreinte sans code", () => {
    // `generateFingerprint("")` vaut "0" : sans cette garde, un code vide
    // s'afficherait comme une empreinte légitime. Invariant de source, le
    // rendu statique ne pouvant pas déclencher l'effet.
    expect(WATERMARK).toMatch(/if \(!normalizedCode\)/);
    expect(WATERMARK).toMatch(/setFingerprint\(''\)/);
  });

  it("l'empreinte affichée reste adossée au code", () => {
    expect(WATERMARK).toMatch(/Réf: \{code\} \| FP: \{fingerprint\}/);
  });
});

describe("Contrat public — l'API ne publie plus de cuid", () => {
  it("la route ne construit plus de champ `id`", () => {
    // `responseData` est une whitelist explicite : plus aucune clé interne.
    expect(VERIFIER_ROUTE).not.toMatch(/^\s*id: attestation\.id,/m);
    // Et le `select` de travail ne le charge plus non plus.
    expect(VERIFIER_ROUTE).not.toMatch(/^\s*id: true,/m);
  });

  it("la page vérificateur ne câble plus l'identifiant", () => {
    expect(VERIFIER_PAGE).not.toMatch(/id: result\.id/);
    expect(VERIFIER_PAGE).toMatch(/code: result\.code/);
  });
});

describe("Autres appelants du document — l'empreinte reste cohérente", () => {
  // Ces deux pages lisent la BASE, pas `/api/verifier` : elles continuaient
  // de transmettre un `data.id` depuis la suppression du champ du type. Elles
  // n'ont plus rien à transmettre — le code suffit à l'empreinte.
  it("la fiche candidat transmet un code, plus d'identifiant", () => {
    expect(USER_DETAIL).toContain("<OfficialDocument");
    expect(USER_DETAIL).not.toMatch(/id: att\.id,/);
    expect(USER_DETAIL).toMatch(/code: att\.code/);
  });

  it("la fiche admin transmet un code, plus d'identifiant", () => {
    expect(ADMIN_DETAIL).toContain("<OfficialDocumentComponent");
    expect(ADMIN_DETAIL).not.toMatch(/id: data\.id,/);
    expect(ADMIN_DETAIL).toMatch(/code: data\.code/);
  });

  it("les deux fiches gardent leur ancre DOM (prop `id`, distincte de `data.id`)", () => {
    // `id` reste une prop de composant pour le DOM : elle n'a rien à voir avec
    // l'identifiant de ligne et ne doit pas disparaître au passage.
    expect(USER_DETAIL).toMatch(/id=\{`attestation-preview-\$\{att\.id\}`\}/);
    expect(ADMIN_DETAIL).toMatch(/id="official-preview-card"/);
  });
});
