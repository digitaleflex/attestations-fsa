import { describe, it, expect, afterEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CountdownTimer, MiniCountdown } from "@/components/CountdownTimer";

/**
 * Carte d'annonce d'un examen planifié — rendu HTML réel, a11y et masquage
 * (#m9/exam-ui).
 *
 * Cette carte est le seul endroit où un compte à rebours touche le DOM, et le
 * premier endroit où une fuite de contenu deviendrait visible pour un candidat.
 * Les tests lisent donc le HTML PRODUIT, pas la source : un `aria-hidden` dans
 * une branche morte ne passerait pas un test de source.
 *
 * `renderToStaticMarkup` suffit — aucun effet n'est exécuté, et le composant se
 * détermine lui-même à partir de `new Date()`. Les échéances sont donc fixées
 * loin de « maintenant » (années 2027 / 2026) pour rester justes.
 */

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Ouverture 14/03/2027 00:00 Porto-Novo, démarrage 15/03/2027 08:00. */
const OPENS_ON = "2027-03-14T23:00:00.000Z";
const SCHEDULED_AT = "2027-03-15T07:00:00.000Z";

const baseProps = {
  examId: "exam-1",
  examName: "Examen final de gestion de projet",
  examDescription: "Épreuve portant sur les trois parties du référentiel.",
  duration: 5400,
};

function renderCountdown(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <CountdownTimer
      scheduledAt={SCHEDULED_AT}
      opensOn={OPENS_ON}
      isAvailable={null}
      {...baseProps}
      {...overrides}
    />,
  );
}

describe("avant l'ouverture : rien ne fuit", () => {
  it("ne rend aucun lien vers l'épreuve", () => {
    // Le e2e « un examen programmé reste verrouillé » compte les `a[href]`
    // vers /exams/{id} : le DOM ne doit pas en contenir avant l'heure, même
    // inerte. On vérifie donc la chaîne complète, pas seulement le href.
    const html = renderCountdown();
    expect(html).not.toContain(`/exams/${baseProps.examId}`);
    expect(html).not.toContain("Commencer");
  });

  it("ne montre ni description, ni durée, ni question count", () => {
    const html = renderCountdown();
    expect(html).not.toContain(baseProps.examDescription);
    expect(html).not.toContain("90 min");
  });

  it("annonce exactement ce qui est autorisé : l'identifiant, le titre, les horaires", () => {
    const html = renderCountdown();
    expect(html).toContain(baseProps.examName);
    // Les horaires, oui : c'est la seule information utile avant le jour J.
    expect(html).toContain("Ouverture");
    expect(html).toContain("Début prévu");
  });

  it("rend le bouton verrouillé et explique pourquoi il est verrouillé", () => {
    // Un bouton `disabled` sans explication est un mur muet pour un lecteur
    // d'écran : l'Utilisateur ne sait pas s'il attend une date ou une panne.
    const html = renderCountdown();
    expect(html).toContain("Accès verrouillé");
    expect(html).toContain("aria-describedby=");
    expect(html).toContain("Le contenu se débloque le");
  });

  it("affiche le jour d'ouverture et l'heure prévue en heure de Porto-Novo", () => {
    const html = renderCountdown();
    // 15/03/2027 08:00 à Porto-Novo, quelle que soit la machine de lecture.
    expect(html).toContain("15/03/2027 08:00");
    expect(html).toContain("Africa/Porto-Novo (UTC+1)");
  });
});

describe("accessibilité du compte à rebours", () => {
  it("expose un rôle timer et un nom accessible", () => {
    const html = renderCountdown();
    expect(html).toContain('role="timer"');
    // Sans nom, le lecteur d'écran annonce « timer » et rien d'autre.
    // React échappe l'apostrophe dans les attributs : `&#x27;`, pas `'`.
    expect(html).toContain(
      `aria-label="Ouverture de l&#x27;épreuve « ${baseProps.examName} »"`,
    );
  });

  it("réserve la lecture des chiffres à une zone live polie, une fois par minute", () => {
    const html = renderCountdown();
    // Les chiffres à la seconde sont décoratifs : 60 annonces par minute
    // transformeraient la carte en conversation impossible.
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain("sr-only");
    // Chaque bloc de chiffres porte `aria-hidden`.
    const hiddenBlocks = html.match(/aria-hidden="true"/g) ?? [];
    expect(hiddenBlocks.length).toBeGreaterThan(4);
  });

  it("n'annonce jamais la seconde, seulement la minute", () => {
    // Garde-fou direct : la phrase live est construite à partir des minutes.
    const html = renderCountdown();
    const live = html.slice(html.indexOf('aria-live="polite"'));
    expect(live).not.toMatch(/seconde/);
  });

  it("n'anime pas la carte en boucle infinie", () => {
    // `animate-pulse` est une boucle de 2 s : au-delà de trois cycles, c'est du
    // contenu clignotant (WCAG 2.2.2). L'urgence se porte par la couleur.
    const html = renderCountdown();
    expect(html).not.toContain("animate-pulse");
    expect(html).not.toContain("animate-bounce");
  });

  it("décore ses icônes pour qu'elles ne soient pas lues deux fois", () => {
    const html = renderCountdown();
    // Les libellés textuels (« Ouverture », « Accès verrouillé ») portent déjà
    // le sens : une icône nommée à côté est du bruit.
    expect(html).not.toMatch(/<svg(?![^>]*aria-hidden)/);
  });
});

describe("à l'heure prévue", () => {
  const pastProps = {
    scheduledAt: "2020-01-15T07:00:00.000Z",
    opensOn: "2020-01-14T23:00:00.000Z",
  };

  it("propose le démarrage avec un lien et un nom qui nomme l'épreuve", () => {
    const html = renderCountdown(pastProps);
    expect(html).toContain(`href="/exams/${baseProps.examId}"`);
    expect(html).toContain("Commencer");
    // « Commencer » seul ne dit pas QUOI : six cartes se ressemblent.
    expect(html).toContain(
      `aria-label="Commencer l&#x27;épreuve « ${baseProps.examName} »"`,
    );
  });

  it("révèle alors la description et la durée", () => {
    const html = renderCountdown(pastProps);
    expect(html).toContain(baseProps.examDescription);
    expect(html).toContain("90 min");
  });

  it("n'affiche plus de compte à rebours mais un état explicite", () => {
    const html = renderCountdown(pastProps);
    expect(html).not.toContain('role="timer"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Session ouverte");
  });
});

describe("MiniCountdown", () => {
  it("résume l'échéance en une ligne et se tait une fois passée", () => {
    const avant = renderToStaticMarkup(
      <MiniCountdown
        scheduledAt={SCHEDULED_AT}
        opensOn={OPENS_ON}
        isAvailable={null}
      />,
    );
    expect(avant).toMatch(/J-\d/);

    const apres = renderToStaticMarkup(
      <MiniCountdown
        scheduledAt="2020-01-15T07:00:00.000Z"
        opensOn="2020-01-14T23:00:00.000Z"
        isAvailable
      />,
    );
    // Une ligne de tableau ne doit pas garder un « 0min » à jamais.
    expect(apres).toBe("");
  });
});
