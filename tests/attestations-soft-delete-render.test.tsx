import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { LifecycleReasonField } from "@/components/admin/attestations/LifecycleReasonField";

/**
 * Le champ « motif » des actions de cycle de vie, sur le HTML PRODUIT.
 *
 * Le fichier jumeau `attestations-soft-delete-ui.test.ts` lit la source ; celui-ci
 * prouve que le nom accessible, la description et l'état d'erreur atteignent
 * vraiment le DOM — un `<Label>` sans `htmlFor`, ou un compteur annoncé deux
 * fois, ne se verraient qu'ici.
 */

const noop = () => {};

function render(props: Partial<React.ComponentProps<typeof LifecycleReasonField>> = {}) {
  return renderToStaticMarkup(
    <LifecycleReasonField
      id="attestation-revoke-reason"
      label="Motif de la révocation (obligatoire)"
      placeholder="Ex : erreur de saisie du nom à la source."
      value=""
      onChange={noop}
      {...props}
    />,
  );
}

describe("Champ motif — nom accessible et description", () => {
  it("le libellé nomme bien le champ", () => {
    const html = render();
    expect(html).toContain('for="attestation-revoke-reason"');
    expect(html).toContain('id="attestation-revoke-reason"');
    expect(html).toContain("Motif de la révocation (obligatoire)");
  });

  it("la zone de texte est bien multiligne et décrite", () => {
    const html = render();
    expect(html).toContain("<textarea");
    expect(html).toContain('aria-describedby="attestation-revoke-reason-hint"');
    expect(html).toContain('id="attestation-revoke-reason-hint"');
  });

  it("le compteur part de 0/5 et suit la saisie", () => {
    expect(render()).toContain("0/5");
    expect(render({ value: "Erreur de saisie" })).toContain("16/5");
  });

  it("un refus serveur est annoncé et marque le champ invalide", () => {
    const html = render({ serverError: "Motif obligatoire." });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Motif obligatoire.");
  });

  it("un motif suffisant ne déclenche aucune erreur", () => {
    const html = render({ value: "Erreur de saisie du nom" });
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('role="alert"');
  });
});
