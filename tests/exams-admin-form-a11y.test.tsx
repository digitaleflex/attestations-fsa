import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StepGeneral } from "@/components/exams/form-steps/step-general";
import { ExamFormData, DEFAULT_PARTS } from "@/components/exams/types";

/**
 * Formulaire admin : saisie du jour d'ouverture et affichage en heure
 * Africa/Porto-Novo (#m9/exam-ui).
 *
 * Deux pièges sont vérifiés ici :
 *  1. le libellé du champ d'ouverture doit être rattaché à son contrôle, sinon
 *     un lecteur d'écran annonce « zone de texte » sans savoir ce qu'elle
 *     attend ;
 *  2. l'admin doit voir l'instant UTC qui sera stocké AVANT d'enregistrer, pour
 *     ne pas piloter l'épreuve dans le fuseau de sa machine.
 */

const root = join(__dirname, "..");

/**
 * React échappe apostrophes et esperluettes dans le HTML produit
 * (`&#x27;`, `&amp;`). On décode avant d'asseoir les assertions sur du texte
 * lisible : le test doit parler de l'interface, pas de son encodage.
 */
function decode(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function renderStep(overrides: Partial<ExamFormData> = {}) {
  const formData: ExamFormData = {
    title: "Examen final",
    status: "SCHEDULED",
    duration: 3600,
    passingScore: 65,
    formationId: "f1",
    parts: DEFAULT_PARTS,
    scheduledAt: "",
    ...overrides,
  };
  return decode(
    renderToStaticMarkup(
      <StepGeneral formData={formData} updateFormData={() => {}} />,
    ),
  );
}

describe("champ du jour d'ouverture", () => {
  it("existe et est annoncé par un libellé rattaché", () => {
    const html = renderStep();
    expect(html).toContain('id="exam-opens-on"');
    // `htmlFor` pointant sur l'id réel : c'est ce qui fait que « Jour
    // d'ouverture au public » est lu avec la zone, pas à côté.
    expect(html).toMatch(/<label[^>]*for="exam-opens-on"/);
    expect(html).toContain("Jour d'ouverture au public");
  });

  it("explique ce que l'ouverture autorise et ce qu'elle retient", () => {
    const html = renderStep();
    // Le candidat voit le titre et les horaires, pas le barème ni la durée :
    // la microstructure doit le dire explicitement.
    expect(html).toContain("ni le contenu");
    expect(html).toContain("ni le barème");
  });

  it("rattache son aide au contrôle via aria-describedby", () => {
    const html = renderStep();
    expect(html).toMatch(/id="exam-opens-on"[^>]*aria-describedby="exam-opens-on-help"/);
    expect(html).toContain('id="exam-opens-on-help"');
  });

  it("affiche le fuseau de saisie pour éviter le contresens d'UTC", () => {
    const html = renderStep();
    // Un admin qui saisit 08:00 en croyant écrire de l'UTC fait commencer
    // l'épreuve une heure trop tôt : il faut donc écrire le fuseau.
    expect(html).toContain("Africa/Porto-Novo (UTC+1)");
  });
});

describe("relecture de l'instant stocké", () => {
  it("montre l'heure locale ET l'ISO UTC côte à côte", () => {
    const html = renderStep({ scheduledAt: "2026-09-26T08:00", opensOn: "2026-09-26" });
    // 08:00 à Porto-Novo = 07:00 UTC. Les deux doivent être visibles.
    expect(html).toContain("26/09/2026 08:00");
    expect(html).toContain("2026-09-26T07:00:00.000Z");
    // L'ouverture de cette journée est bien le 25 à 23:00 UTC, pas le 26 à 00:00.
    expect(html).toContain("2026-09-25T23:00:00.000Z");
  });

  it("signale un début placé avant l'ouverture", () => {
    // Cas réel : l'admin ouvre le 26 mais programme l'épreuve le 25 à 20:00.
    // Le candidat verrait une épreuve qu'il ne peut pas démarrer.
    const html = renderStep({ scheduledAt: "2026-09-25T20:00", opensOn: "2026-09-26" });
    expect(html).toContain("précède l'ouverture");
  });

  it("affiche un guidage tant que la date est vide", () => {
    const html = renderStep();
    expect(html).toContain("Renseignez une date pour voir l'instant stocké.");
  });
});

describe("contrats de payload côté interface", () => {
  const formSource = readFileSync(
    join(root, "components/exams/exam-form.tsx"),
    "utf-8",
  );
  const examsPageSource = readFileSync(
    join(root, "app/(user)/exams/page.tsx"),
    "utf-8",
  );

  it("convertit la saisie en UTC par le chemin partagé, pas par un new Date() local", () => {
    // `new Date("2026-09-26T08:00")` lit le fuseau de la machine : c'est
    // exactement le bug que la spécification interdit.
    expect(formSource).toContain("fromAppWallClock(formData.scheduledAt)");
    expect(formSource).toContain("opensOn: formData.opensOn");
    expect(formSource).not.toContain("new Date(formData.scheduledAt).toISOString()");
  });

  it("refuse un examen programmé sans jour d'ouverture", () => {
    expect(formSource).toContain("Le jour d'ouverture est requis");
  });

  it("n'affiche plus les horaires candidat dans le fuseau de la machine", () => {
    // Aucune date d'examen ne doit être rendue via `toLocale*` sans
    // `timeZone` : la machine du navigateur n'est pas le fuseau de référence.
    expect(examsPageSource).not.toContain("toLocaleString(\"fr-FR\"");
    expect(examsPageSource).not.toContain("toLocaleDateString");
    expect(examsPageSource).toContain("formatAppDateTime(exam.scheduledAt)");
  });

  it("n'imbrique pas de bouton dans un lien", () => {
    // Deux éléments interactifs imbriqués : le clavier ne peut pas focuser le
    // nœud interne, et VoiceOver annonce le lien puis le bouton.
    expect(examsPageSource).not.toMatch(/<Link[^>]*>\s*<Button/);
  });
});
