import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression : la suppression d'une attestation est une suppression
 * LOGIQUE, avec motif obligatoire.
 *
 * L'endpoint `DELETE /api/attestations/[id]` refuse un corps vide
 * (400 `MOTIF_REQUIS`) et refuse une purge physique
 * (409 `ATTESTATION_PHYSICAL_DELETE_REFUSED`). Les deux pages admin appelaient
 * `DELETE` sans corps et promettaient un effacement définitif : l'opérateur
 * recevait un refus opaque, ou pire, croire la ligne perdue alors qu'elle est
 * archivée.
 *
 * Ces invariants sont lus dans la source : le dépôt n'embarque pas de rendu
 * React pour ces pages (cf. `tests/attestations-ui-a11y.test.ts`).
 */

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf8");
}

const LIST = read("app", "admin", "attestations", "page.tsx");
const DETAIL = read("app", "admin", "attestations", "[id]", "page.tsx");
const DIALOG = read(
  "components",
  "admin",
  "attestations",
  "SoftDeleteAttestationDialog.tsx",
);
const REASON_FIELD = read(
  "components",
  "admin",
  "attestations",
  "LifecycleReasonField.tsx",
);

const PAGES: [string, string][] = [
  ["liste admin", LIST],
  ["fiche admin", DETAIL],
];

describe("Suppression logique — un motif est demandé, jamais un effacement muet", () => {
  it("aucune page admin n'appelle plus DELETE sans corps", () => {
    for (const [label, source] of PAGES) {
      expect(source, label).not.toMatch(/method:\s*"DELETE"(?!\s*,\s*body)/);
      // Le DELETE est exécuté par le dialogue partagé, qui porte le motif.
      expect(source, label).toContain("SoftDeleteAttestationDialog");
    }
  });

  it("le motif est transmis dans le corps de la requête", () => {
    expect(DIALOG).toMatch(/method:\s*"DELETE",\s*body:\s*JSON\.stringify\(\{\s*reason:\s*trimmed\s*\}\)/);
  });

  it("la longueur minimale est validée côté client", () => {
    // Le serveur refuse en dessous de 5 caractères : l'interface ne doit pas
    // envoyer une requête vouée à l'échec.
    expect(DIALOG).toMatch(/const MIN_REASON_LENGTH = 5/);
    expect(DIALOG).toMatch(/trimmed\.length < MIN_REASON_LENGTH/);
    expect(DIALOG).toMatch(/disabled=\{isSubmitting \|\| isTooShort\}/);
  });

  it("le motif est multiligne, étiqueté et focalisé à l'ouverture", () => {
    expect(DIALOG).toMatch(/<Textarea/);
    expect(DIALOG).toMatch(/rows=\{3\}/);
    expect(DIALOG).toMatch(/htmlFor="attestation-soft-delete-reason"/);
    expect(DIALOG).toMatch(/autoFocus/);
    // Focus explicite à l'ouverture : l'ordre d'annonce titre → description →
    // champ est alors celui du formulaire.
    expect(DIALOG).toMatch(/requestAnimationFrame\(\(\) => textareaRef\.current\?\.focus\(\)\)/);
    // Le motif d'une suppression antérieure ne doit pas resurgir.
    expect(DIALOG).toMatch(/if \(!open\) \{\s*reset\(\);/);
  });

  it("états désactivé, chargement et erreur sont rendus", () => {
    expect(DIALOG).toMatch(/aria-busy=\{isSubmitting\}/);
    expect(DIALOG).toMatch(/Suppression en cours/);
    expect(DIALOG).toMatch(/role="alert"/);
    // Le clavier reste un chemin complet : Entrée valide le formulaire.
    expect(DIALOG).toMatch(/requestSubmit\(\)/);
  });
});

describe("Libellés — dire ce qui se passe vraiment", () => {
  it("plus aucune promesse d'effacement définitif", () => {
    for (const [label, source] of PAGES) {
      expect(source, label).not.toContain("Supprimer définitivement");
      expect(source, label).not.toMatch(/sera (définitivement|irréversiblement) supprim/);
      expect(source, label).not.toMatch(/Action Irréversible/);
    }
    expect(DIALOG).not.toMatch(/Supprimer définitivement/);
  });

  it("le succès est qualifié de suppression logique", () => {
    expect(DIALOG).toMatch(/toast\.success\("Attestation supprimée \(logique\)"/);
    expect(LIST).not.toMatch(/toast\.success\("Attestation supprimée"\)/);
  });

  it("révoquer et supprimer logiquement sont distingués", () => {
    // Révoquer = le document reste visible publiquement.
    expect(DETAIL).toMatch(/reste visible et\s*\n?\s*vérifiable/);
    // Supprimer logiquement = retrait du vérificateur, preuve conservée.
    expect(DIALOG).toMatch(/disparaît du vérificateur/);
    expect(DIALOG).toMatch(/archiv/);
  });

  it("le statut REVOKED n'est plus affiché comme un simple rejet", () => {
    expect(DETAIL).toMatch(/case "REVOKED": return "Révoquée";/);
    expect(DETAIL).toMatch(/case "REJECTED": return "Rejetée";/);
    expect(LIST).toMatch(/case "REVOKED": return "Révoquée";/);
    expect(LIST).toMatch(/case "REJECTED": return "Rejetée";/);
  });
});

describe("Liste admin — les lignes déjà supprimées logiquement sont dites comme telles", () => {
  it("un indicateur discret remplace l'action impossible", () => {
    // Le serveur répond 409 sur une ligne déjà supprimée : mieux vaut le dire
    // dans la ligne que faire confirmer un refus déjà acquitté.
    expect(LIST).toContain("Supprimée (logique)");
    expect(LIST).toMatch(/disabled=\{isSoftDeleted\}/);
    expect(LIST).toMatch(/Déjà supprimée logiquement/);
  });

  it("l'indicateur est piloté par deletedAt renvoyé par l'API", () => {
    expect(LIST).toMatch(/const isSoftDeleted = Boolean\(a\.deletedAt\);/);
    expect(LIST).toMatch(/deletedAt\?: string \| null;/);
  });
});

describe("Erreurs serveur traduites en consignes", () => {
  it("les deux codes métier du DELETE sont traités", () => {
    expect(DIALOG).toMatch(/MOTIF_REQUIS:/);
    expect(DIALOG).toMatch(/ATTESTATION_PHYSICAL_DELETE_REFUSED:/);
    // Une ligne déjà supprimée logiquement est figée : le dire, pas planter.
    expect(DIALOG).toMatch(/ATTESTATION_ALREADY_SOFT_DELETED:/);
  });

  it("aucun code technique brut n'est affiché à l'opérateur", () => {
    expect(DIALOG).not.toMatch(/Code: \$\{error\.code\}/);
    expect(DIALOG).toMatch(/const SERVER_ERRORS: Record/);
  });

  it("l'erreur reste lisible même sans toast doublon", () => {
    // `apiFetch(..., false)` : le dialogue affiche l'erreur, pas un toast
    // technique au-dessus du dialogue.
    expect(DIALOG).toMatch(/false, \/\/ l'erreur est rendue dans le dialogue/);
  });
});

describe("Fiche admin — les deux autres actions de cycle de vie restent honnêtes", () => {
  it("la rétrogradation n'annonce plus une suppression", () => {
    expect(DETAIL).not.toContain("supprimée définitivement");
    expect(DETAIL).toMatch(/archivée/);
  });

  it("chaque action a son propre motif", () => {
    // Un motif partagé entre révocation et rétrogradationallowait d'envoyer un
    // motif d'annulation dans une demande de repasser l'examen.
    expect(DETAIL).toMatch(/const \[revokeReason, setRevokeReason\]/);
    expect(DETAIL).toMatch(/const \[retrogradeReason, setRetrogradeReason\]/);
    expect(DETAIL).not.toMatch(/actionReason/);
  });

  it("le champ motif partagé valide la longueur et reste accessible", () => {
    expect(REASON_FIELD).toMatch(/LIFECYCLE_REASON_MIN_LENGTH = 5/);
    expect(REASON_FIELD).toMatch(/htmlFor=\{id\}/);
    expect(REASON_FIELD).toMatch(/aria-describedby=\{`\$\{id\}-hint`\}/);
    expect(REASON_FIELD).toMatch(/rows=\{3\}/);
    expect(REASON_FIELD).toMatch(/role="alert"/);
  });
});
