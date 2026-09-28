import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Anti-régression du parcours de téléchargement officiel (#258).
 *
 * Invariants vérifiés par lecture de source (le dépôt n'embarque pas de rendu
 * React) :
 *  1. aucun PDF n'est fabriqué dans le navigateur (html2pdf, jsPDF,
 *     window.print) sur les parcours officiels ;
 *  2. les QR pointent vers la route publique par query string, via
 *     l'implémentation unique `attestationVerificationPath` ;
 *  3. le téléchargement passe par le PDF serveur
 *     (`startOfficialPdfDownload`), jamais par une capture du DOM.
 */

const qrSources = [
  "app/(user)/attestations/page.tsx",
  "app/(user)/attestations/[id]/page.tsx",
  "app/admin/attestations/[id]/page.tsx",
];

const BROWSER_PDF_PATTERNS = [
  /html2pdf/,
  /html2canvas/,
  /jsPDF/,
  /window\.print\(/,
  /from\(element\)/,
];

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("liens de vérification des attestations", () => {
  it.each(qrSources)("cible la route publique par query string dans %s", (source) => {
    const contents = read(source);

    expect(contents).toContain("attestationVerificationPath(");
    expect(contents).not.toContain("/verifier/${");
  });
});

describe("parcours officiels — aucun PDF généré dans le navigateur (#258)", () => {
  it.each(qrSources)("%s ne capture plus le DOM", (source) => {
    const contents = read(source);
    for (const pattern of BROWSER_PDF_PATTERNS) {
      expect(contents, `${source} ne doit plus correspondre à ${pattern}`).not.toMatch(pattern);
    }
  });

  it.each(qrSources)("%s télécharge le document serveur scellé", (source) => {
    const contents = read(source);
    expect(contents).toContain("startOfficialPdfDownload(");
    expect(contents).toContain("isOfficialPdfDownloadable(");
  });

  it("la liste candidat ne rend plus de template caché de capture", () => {
    const contents = read("app/(user)/attestations/page.tsx");
    expect(contents).not.toContain("cert-template-");
    expect(contents).not.toContain("CertificateTemplate");
  });

  it("le composant de capture canvas n'est plus importé par la fiche candidat", () => {
    const contents = read("app/(user)/attestations/[id]/page.tsx");
    // L'aperçu reste affiché (il documente le contenu), mais plus en mode
    // impression : la largeur figée n-existait que pour la capture PDF.
    expect(contents).toContain("OfficialDocument");
    expect(contents).not.toMatch(/isPrinting/);
  });
});
