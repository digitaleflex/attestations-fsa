import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/**
 * Comportement observable du design system, rendu pour de vrai (#P2).
 *
 * Le fichier jumeau `design-system-a11y.test.ts` vérifie les invariants
 * structurels dans la SOURCE. Celui-ci les vérifie sur le HTML PRODUIT : c'est
 * le seul moyen de prouver qu'un `aria-valuenow` atteint vraiment l'attribut,
 * ou qu'un avertissement part vraiment. Un test qui lit la source peut
 * valider du code mort (cf. le pendant `markDecorativeIcons`, retiré parce
 * qu'il ne se déclenchait jamais) ; celui-ci ne le peut pas.
 *
 * `renderToStaticMarkup` suffit : les primitives concernées n'ont ni état ni
 * effet de bord, et cela évite d'ajouter une dépendance de rendu DOM.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Progress : la valeur atteint bien le HTML rendu", () => {
  it("publie role=progressbar et aria-valuenow", () => {
    const html = renderToStaticMarkup(<Progress value={42} />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  it("donne un nom accessible et un aria-valuetext en pourcentage", () => {
    const html = renderToStaticMarkup(<Progress value={42} />);
    // Sans nom, la jauge est inexploitable ; sans valuetext, « 42 » se lisait
    // comme un nombre nu.
    expect(html).toContain('aria-label="Progression"');
    expect(html).toContain('aria-valuetext="42 %"');
  });

  it("utilise le libellé fourni par l'appelant", () => {
    const html = renderToStaticMarkup(
      <Progress value={10} label="Avancement de la saisie" />,
    );
    expect(html).toContain('aria-label="Avancement de la saisie"');
  });

  it("borne une valeur aberrante au lieu d'exposer un aria-valuenow hors échelle", () => {
    // 140 % produirait un aria-valuenow invalide, rejeté par les lecteurs.
    expect(renderToStaticMarkup(<Progress value={140} />)).toContain(
      'aria-valuenow="100"',
    );
    expect(renderToStaticMarkup(<Progress value={-20} />)).toContain(
      'aria-valuenow="0"',
    );
  });

  it("sans valeur, reste indéterminée plutôt que d'annoncer un 0 %", () => {
    const html = renderToStaticMarkup(<Progress />);
    expect(html).toContain('role="progressbar"');
    // Pas de valeur affirmative : on ne pretend pas connaître l'avancement.
    expect(html).not.toContain("aria-valuenow=");
  });

  it("0 % et 100 % sont bien distingués dans le HTML", () => {
    // Régression de Bourrage : les deux extrêmes donnaient la même classe de
    // translation si la borne basse avalait la borne haute.
    const zero = renderToStaticMarkup(<Progress value={0} />);
    const full = renderToStaticMarkup(<Progress value={100} />);
    expect(zero).toContain("translateX(-100%)");
    expect(full).toContain("translateX(-0%)");
  });
});

describe("Button : le garde-fou des boutons iconiques", () => {
  it("avertit quand un bouton size=icon n'a aucun nom accessible", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderToStaticMarkup(
      <Button size="icon">
        <Search />
      </Button>,
    );
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toMatch(/sans nom accessible/);
  });

  it("n'avertit pas quand aria-label est présent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderToStaticMarkup(
      <Button size="icon" aria-label="Rechercher">
        <Search />
      </Button>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("n'avertit pas quand un nom textuel est présent (dont sr-only)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderToStaticMarkup(
      <Button size="icon">
        <Search />
        <span className="sr-only">Rechercher</span>
      </Button>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("n'avertit pas sur un bouton qui a du texte, même en taille icon", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderToStaticMarkup(<Button size="icon">Rechercher</Button>);
    expect(warn).not.toHaveBeenCalled();
  });

  it("n'avertit pas sur les tailles qui portent du texte", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderToStaticMarkup(<Button>Valider</Button>);
    renderToStaticMarkup(<Button size="sm">Valider</Button>);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("Button : la cible tactile atteint le HTML rendu", () => {
  it("la taille icon sort un carré de 44 x 44 px", () => {
    const html = renderToStaticMarkup(
      <Button size="icon" aria-label="Fermer" />,
    );
    expect(html).toContain("h-11");
    expect(html).toContain("w-11");
    expect(html).toContain("min-w-11");
  });

  it("chaque taille déclare un plancher min-h (non surchargeable)", () => {
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      const html = renderToStaticMarkup(
        <Button size={size} aria-label="Action">
          Action
        </Button>,
      );
      expect(html, `taille ${size} sans min-h`).toMatch(/min-h-\d+/);
    }
  });

  it("décalage l'anneau de focus pour le détacher du fond", () => {
    const html = renderToStaticMarkup(<Button>Valider</Button>);
    expect(html).toContain("focus-visible:ring-offset-2");
    expect(html).toContain("focus-visible:ring-offset-background");
  });

  it("conserve le rendu de asChild (Slot) sans le casser", () => {
    // Le wrapper a changé de forme pendant cette vague : un Slot malbranché
    // afficherait un <button> imbriqué dans un <a>.
    const html = renderToStaticMarkup(
      <Button asChild>
        <a href="/exams">Mes examens</a>
      </Button>,
    );
    expect(html).toContain("<a");
    expect(html).not.toContain("<button");
  });
});
