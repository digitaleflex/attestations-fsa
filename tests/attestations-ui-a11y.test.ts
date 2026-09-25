import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression UI/a11y des pages « attestations » (P1).
 *
 * Ces invariants sont vérifiés par lecture de source : le dépôt n'embarque pas
 * de rendu React (pas de @testing-library/react dans `package.json`), et les
 * composants concernés sont pilotés par des container queries dont le rendu
 * dépend de la largeur du document — un test de rendu en jsdom, à largeur fixe
 * 1024 px par défaut, ne les exerciseait pas du bon.
 *
 * Ce que le test protège, point par point :
 *  1. le résumé mobile de `OfficialDocument` ne doit PAS être une media query
 *     viewport : en mode impression le document est figé à 1120 px, un
 *     `md:` based sur la largeur de l'écran ferait bouger le PDF selon
 *     l'appareil ;
 *  2. les boutons icône seule (QR, téléchargement) doivent porter un
 *     `aria-label` — `title` seul est ignoré au clavier et par beaucoup de
 *     lecteurs d'écran ;
 *  3. chargement / erreur / vide / relance doivent exister sur chaque page ;
 *  4. le filigrane est décoratif : il ne doit jamais être annoncé.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OFFICIAL_DOCUMENT = read(path.join("components", "OfficialDocument.tsx"));
const WATERMARK = read(path.join("components", "AttestationWatermark.tsx"));
const CERTIFICATE = read(path.join("components", "CertificateTemplate.tsx"));
const USER_LIST = read(path.join("app", "(user)", "attestations", "page.tsx"));
const USER_DETAIL = read(path.join("app", "(user)", "attestations", "[id]", "page.tsx"));
const ADMIN_DETAIL = read(path.join("app", "admin", "attestations", "[id]", "page.tsx"));

describe("OfficialDocument — résumé mobile sans casser le PDF A4", () => {
  it("pilote la mise en page par une container query, pas par le viewport", () => {
    // La racine du document porte le conteneur : en impression elle est figée
    // à 1120 px, donc les paliers `@lg:` (512 px) et `@3xl:` (768 px) sont
    // franchis et le rendu A4 est celui d'aujourd'hui.
    expect(OFFICIAL_DOCUMENT).toMatch(/@container/);
    expect(OFFICIAL_DOCUMENT).toMatch(/@lg:/);
    expect(OFFICIAL_DOCUMENT).toMatch(/@3xl:/);
    // Aucun `md:` (ni `sm:` pilotant la typo du document) ne doit subsister :
    // ces variantes suivent la largeur de l'écran, pas celle du document.
    expect(OFFICIAL_DOCUMENT).not.toMatch(/(^|[\s"'`])md:/);
  });

  it("conserve les dimensions A4 figées du mode impression", () => {
    expect(OFFICIAL_DOCUMENT).toMatch(/w-\[1120px\] min-w-\[1120px\] h-\[790px\] max-h-\[790px\]/);
  });

  it("resserre le document sur petit écran (padding et nom à l'échelle)", () => {
    // Le padding est passé sur le bloc de contenu, sinon il ne pourrait pas
    // réagir à la container query de sa propre racine.
    expect(OFFICIAL_DOCUMENT).toMatch(/p-5 @lg:p-8 @3xl:p-14/);
    // Nom long : la plus grosse taille de base doit rester lisible sur mobile.
    expect(OFFICIAL_DOCUMENT).toMatch(/"text-xl @lg:text-3xl @3xl:text-4xl"/);
    // Les libellés 9 px, illisibles sur téléphone, remontent à 10 px.
    expect(OFFICIAL_DOCUMENT).toMatch(/text-\[10px\] @3xl:text-\[9px\]/);
    // Coupure des mots longs (noms compounds, codes) plutôt que débordement.
    expect(OFFICIAL_DOCUMENT).toMatch(/break-words/);
  });

  it("remonte les contrastes des textes secondaires (WCAG AA)", () => {
    // #94a3b8 (2,5:1 sur blanc) et #64748b sur #f8fafc (4,6:1) sont trop justes
    // pour des libellés de 9-10 px.
    expect(OFFICIAL_DOCUMENT).not.toMatch(/"#94a3b8"|'#94a3b8'/);
    expect(OFFICIAL_DOCUMENT).toMatch(/const MUTED = "#475569"/);
    expect(OFFICIAL_DOCUMENT).toMatch(/const MUTED_ON_WHITE = "#64748b"/);
    // Bordures de fiches : #f1f5f9 est invisible sur le fond #f8fafc.
    expect(OFFICIAL_DOCUMENT).not.toContain("borderColor: '#f1f5f9'");
  });
});

describe("Filigrane — purement décoratif", () => {
  it("le logo de fond n'est pas annoncé", () => {
    expect(OFFICIAL_DOCUMENT).toMatch(/alt=""\s*\n\s*aria-hidden="true"/);
    expect(OFFICIAL_DOCUMENT).not.toMatch(/alt="Watermark"/);
  });

  it("AttestationWatermark reste aria-hidden dans ses deux modes", () => {
    // Visible (motif + référence) et invisible (pixels encodés).
    const ariaHidden = WATERMARK.match(/aria-hidden="true"/g) ?? [];
    expect(ariaHidden.length).toBe(2);
  });

  it("les ornements du certificat de PDF sont eux aussi masqués", () => {
    expect(CERTIFICATE).not.toMatch(/alt="Logo"/);
    expect(CERTIFICATE).toMatch(/aria-hidden="true"/);
  });
});

describe("Boutons icône seule — nom accessible explicite", () => {
  it("QR et téléchargement de la liste candidat", () => {
    expect(USER_LIST).toMatch(/aria-label=\{\s*att\.isLocked\s*\n\s*\? `QR code indisponible/);
    expect(USER_LIST).toMatch(/Afficher le QR code de vérification de l'attestation/);
    expect(USER_LIST).toMatch(/Télécharger l'attestation \$\{att\.code\} au format PDF/);
    expect(USER_LIST).toMatch(/aria-busy=\{downloading === att\.code\}/);
  });

  it("les liens d'aperçu et de partage de la fiche détail", () => {
    expect(USER_DETAIL).toMatch(/aria-label="Retour à mes attestations"/);
    expect(USER_DETAIL).toMatch(/Signaler une erreur sur l'attestation/);
    expect(USER_DETAIL).toMatch(/Copier le lien de vérification de l'attestation/);
  });
});

describe("États de page — chargement / erreur / vide / relance", () => {
  it("liste candidat : les quatre états existent", () => {
    // Chargement annoncé politely.
    expect(USER_LIST).toMatch(/if \(isLoading\) \{/);
    expect(USER_LIST).toMatch(/role="status"[\s\S]{0,80}aria-live="polite"/);
    expect(USER_LIST).toMatch(/aria-busy="true"/);

    // Erreur : explication + relance via refetch (et non un simple toast).
    expect(USER_LIST).toMatch(/if \(isError\) \{/);
    expect(USER_LIST).toMatch(/Impossible de charger vos attestations/);
    expect(USER_LIST).toMatch(/onClick=\{\(\) => refetch\(\)\}/);
    expect(USER_LIST).toMatch(/isFetching \? "Nouvelle tentative…"/);

    // Vide : deux messages distincts, celui des filtres propose unreset.
    expect(USER_LIST).toMatch(/Vous n'avez pas encore d'attestation/);
    expect(USER_LIST).toMatch(/Aucune attestation ne correspond à ces filtres/);
    expect(USER_LIST).toMatch(/Réinitialiser les filtres/);
  });

  it("liste candidat : la recherche ne casse plus sur une formation sans nom", () => {
    // `att.formation?.name.toLowerCase()` levait sur un nom undefined.
    expect(USER_LIST).toMatch(/\(att\.formation\?\.name \|\| ""\)\.toLowerCase\(\)/);
  });

  it("fiche détail candidat : absent et erreur réseau ne se confondent plus", () => {
    expect(USER_DETAIL).toMatch(/if \(isError \|\| !att\) \{/);
    expect(USER_DETAIL).toMatch(/Document introuvable/);
    expect(USER_DETAIL).toMatch(/Impossible d'ouvrir ce document/);
    expect(USER_DETAIL).toMatch(/onClick=\{\(\) => refetch\(\)\}/);
    expect(USER_DETAIL).toMatch(/role="status"[\s\S]{0,80}aria-busy="true"/);
  });

  it("fiche détail admin : un échec réseau n'affiche plus « non trouvée »", () => {
    expect(ADMIN_DETAIL).toMatch(/const \[loadError, setLoadError\]/);
    expect(ADMIN_DETAIL).toMatch(/Chargement impossible/);
    expect(ADMIN_DETAIL).toMatch(/setReloadKey\(\(k\) => k \+ 1\)/);
    expect(ADMIN_DETAIL).toMatch(/aria-busy="true"/);
  });
});

describe("Garde-fou — la page détail candidat ne lance plus de requête morte", () => {
  it("plus de fetch /api/public/settings inutilisé", () => {
    expect(USER_DETAIL).not.toContain("/api/public/settings");
  });
});
