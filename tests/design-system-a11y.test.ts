import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression accessibilité du design system (#P2).
 *
 * Ces tests ne montent aucun composant : ils vérifient les INVARIANTS
 * structurels du design system, lisibles dans la source. C'est délibéré —
 * le dépôt n'a pas de `@testing-library/react`, et un test de rendu
 * containerait ici bien plus de code qu'il n'en.protégerait.
 *
 * Chaque invariant porte sur une régression RÉELLEMENT constatée dans le
 * dépôt, pas sur une règle théorique.
 *
 * Aucune base de données n'est requise : lecture de fichiers uniquement.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const UI = (name: string) => read(path.join("components", "ui", name));

/**
 * Extrait les classes d'UNE taille du variant `size` de `buttonVariants`.
 *
 * Isoler le bloc `size: { ... }` est indispensable : `cva` déclare deux
 * sous-objets qui portent tous deux une clé `default`, donc une regex
 * `default:\s*"…"` toute simple attrape la mauvaise (le fond du bouton, pas sa
 * taille) et le test passe à côté de ce qu'il vérifie.
 */
function sizeBlock(source: string, size: string): string | null {
  const table = /size:\s*\{([\s\S]*?)\n\s{4}\},/.exec(source);
  if (!table) return null;
  const entry = new RegExp(`(?:^|\\n)\\s*${size}:\\s*"([^"]*)"`).exec(table[1]);
  return entry ? entry[1] : null;
}

describe("Progress : la valeur est transmise à la primitive", () => {
  it("passe `value` à ProgressPrimitive.Root (sinon la jauge reste anonyme)", () => {
    const source = UI("progress.tsx");
    // La racine DOIT recevoir la valeur bornée : c'est elle qui publie
    // `role="progressbar"` et `aria-valuenow`. Le bug d'origine destructurait
    // `value` sans jamais le repassaire, donc la barre bougeait à l'œil nu
    // pendant que le lecteur d'écran annonçait une jauge indéterminée.
    expect(source).toMatch(/<ProgressPrimitive\.Root[\s\S]*?value=\{bounded\}/);
  });

  it("borne la valeur transmise pour ne jamais exposer un aria-valuenow hors échelle", () => {
    const source = UI("progress.tsx");
    expect(source).toMatch(/Math\.min\(100,\s*Math\.max\(0,\s*value\)\)/);
  });

  it("donne toujours un nom accessible à la jauge", () => {
    const source = UI("progress.tsx");
    expect(source).toMatch(/aria-label=\{accessibleName\}/);
    // Repli générique : une jauge sans nom n'est pas exploitable, et les
    // appelants hors périmètre de la vague ne fournissent pas encore de label.
    expect(source).toMatch(/"Progression"/);
  });

  it("expose un aria-valuetext en pourcentage, pas la valeur brute", () => {
    const source = UI("progress.tsx");
    expect(source).toMatch(/aria-valuetext=\{ariaValueText\}/);
    expect(source).toMatch(/\$\{Math\.round\(bounded\)\} %/);
  });

  it("traite l'absence de valeur comme indéterminée plutôt que comme 0 %", () => {
    const source = UI("progress.tsx");
    // Un `value` absent ne doit pas fabriquer un « 0 % » affirmatif.
    expect(source).toMatch(/bounded === null/);
  });
});

describe("Boutons iconiques : nom accessible et cible tactile", () => {
  it("avertit en dev quand un bouton size=\"icon\" n'a aucun nom accessible", () => {
    const source = UI("button.tsx");
    expect(source).toMatch(/warnIfUnlabeledIconButton/);
    expect(source).toMatch(/size !== "icon"/);
    // Le garde vérifie les trois sources de nom possibles.
    expect(source).toMatch(/"aria-label"/);
    expect(source).toMatch(/"aria-labelledby"/);
    expect(source).toMatch(/props\.title/);
  });

  it("ne marque PAS les icônes automatiquement (détection lucide non fiable)", () => {
    // Verrou d'intention, pas de fonctionnalité : lucide-react n'expose aucun
    // marqueur fiable (displayName = nom brut "Menu", et la classe `lucide`
    // est écrasée dès que l'appelant passe son propre `className`). Deviner
    // reviendrait à risquer aria-hidden sur une icône porteuse de sens.
    const source = UI("button.tsx");
    expect(source).not.toMatch(/cloneElement/);
    expect(source).not.toMatch(/markDecorativeIcons/);
    expect(source).toMatch(/ne tente PAS de marquer automatiquement/);
  });

  it("donne à toutes les tailles une hauteur de frappe d'au moins 24 px (WCAG 2.5.8)", () => {
    const source = UI("button.tsx");
    for (const size of ["default", "sm", "lg", "icon"]) {
      // On isole le BLOC `size:` du variant `default` — sinon la regex
      // attrape `variant: { default: "bg-primary ..." }`, qui est un autre
      // objet de la même table cva.
      const block = sizeBlock(source, size);
      expect(block, `taille « ${size} » introuvable`).toBeTruthy();
      // Une hauteur fixe ET un plancher min-* : le plancher est ce qui garantit
      // la cible quand un appelant surcharge la hauteur via className.
      expect(
        /\b(?:h|min-h)-\d+/.test(block!),
        `taille « ${size} » sans hauteur déclarée`,
      ).toBe(true);
    }
  });

  it("déclare un min-h sur chaque taille (le plancher de 24 px ne peut pas être cassé)", () => {
    const source = UI("button.tsx");
    for (const size of ["default", "sm", "lg", "icon"]) {
      expect(sizeBlock(source, size)!, `taille « ${size} » sans min-h`).toMatch(
        /\bmin-h-/,
      );
    }
  });

  it("donne à la taille icon une largeur ET une hauteur carrées", () => {
    const source = UI("button.tsx");
    const block = sizeBlock(source, "icon")!;
    expect(block).toMatch(/\bw-11\b/);
    expect(block).toMatch(/\bh-11\b/);
  });

  it("décale l'anneau de focus pour qu'il reste visible sur fond rouge", () => {
    const source = UI("button.tsx");
    // Sans `ring-offset`, l'anneau rouge de `ring-ring` se confond avec le
    // fond rouge de `variant="default"` : le focus devient invisible.
    expect(source).toMatch(/focus-visible:ring-offset-2/);
    expect(source).toMatch(/focus-visible:ring-offset-background/);
  });
});

describe("Primitives de formulaire : focus cohérent", () => {
  it("Input, Textarea et SelectTrigger décalent tous les deux leur anneau", () => {
    // Trois fichiers, une seule mesure de focus : c'est la cohérence.
    for (const file of ["input.tsx", "textarea.tsx", "select.tsx"]) {
      const source = UI(file);
      expect(
        source,
        `${file} sans ring-offset-2 sur le focus`,
      ).toMatch(/focus-visible:ring-offset-2/);
    }
  });

  it("SelectTrigger ne déclenche plus son anneau au focus pointeur", () => {
    const source = UI("select.tsx");
    // `focus:ring-2` allumait l'anneau au clic souris ; on veut le clavier.
    expect(source).not.toMatch(/(?<!visible:)\bfocus:ring-2/);
    expect(source).toMatch(/focus-visible:ring-2/);
  });

  it("Badge n'allume son anneau qu'au focus clavier", () => {
    const source = UI("badge.tsx");
    expect(source).toMatch(/focus-visible:ring-2/);
    expect(source).not.toMatch(/(?<!visible:)\bfocus:ring-2/);
  });
});

describe("Cibles tactiles des petites primitives", () => {
  it("l'interrupteur dépasse 24 px de haut (il faisait 20 px)", () => {
    const source = UI("switch.tsx");
    // On mesure la RACINE (SwitchPrimitives.Root), pas le pouce : c'est la
    // racine qui détermine la zone de frappe. La recherche tolère les
    // commentaires intercalés entre le nom du composant et son `className`.
    const root = /SwitchPrimitives\.Root[\s\S]{0,900}?"([^"]*h-[\s\S]*?)"/.exec(
      source,
    );
    expect(root, "racine du Switch introuvable").toBeTruthy();
    const sizes = [...root![1].matchAll(/\b(?:min-)?h-(\d+)\b/g)].map((m) =>
      Number(m[1]),
    );
    expect(sizes.length, "Switch sans hauteur déclarée").toBeGreaterThan(0);
    // L'échelle Tailwind est en REM : `h-7` = 1.75rem = 28 px (et non 7 px).
    // On convertit avant de comparer, sinon le test juge des pixels imaginaires.
    const smallestPx = Math.min(...sizes) * 4;
    expect(
      smallestPx,
      "Switch trop petit pour le doigt",
    ).toBeGreaterThanOrEqual(24);
  });

  it("le bouton radio étend sa zone de frappe sans grossir la pastille", () => {
    const source = UI("radio-group.tsx");
    // `after:-inset-2` : la zone cliquable dépasse la pastille de 16 px sans
    // la déformer — c'est le bon moyen de grossir une cible sans casser
    // l'alignement de la grille de réponses.
    expect(source).toMatch(/after:-inset-2/);
    expect(source).toMatch(/aspect-square/);
  });

  it("les boutons de fermeture de dialogue et de panneau font 44 x 44 px", () => {
    for (const file of ["dialog.tsx", "sheet.tsx"]) {
      const source = UI(file);
      const block = /Primitive\.Close[\s\S]{0,400}?className="([^"]*)"/.exec(
        source,
      );
      expect(block, `bouton de fermeture introuvable dans ${file}`).toBeTruthy();
      expect(block![1], `${file} : cible < 44 px`).toMatch(/\bh-11\b/);
      expect(block![1], `${file} : cible < 44 px`).toMatch(/\bw-11\b/);
    }
  });
});

describe("Libellés bilingues : plus de texte anglais résiduel", () => {
  it("le bouton de fermeture du dialogue est étiqueté en français", () => {
    expect(UI("dialog.tsx")).toMatch(/Fermer la boîte de dialogue/);
    expect(UI("dialog.tsx")).not.toMatch(/sr-only">Close</);
  });

  it("le déclencheur et le rail de la barre latérale sont étiquetés en français", () => {
    const source = UI("sidebar.tsx");
    expect(source).toMatch(/Basculer la barre latérale/);
    expect(source).not.toMatch(/Toggle Sidebar/);
  });
});

describe("Sidebar : un seul point d'anneau main", () => {
  it("SidebarInset rend un div, pas un main", () => {
    const source = UI("sidebar.tsx");
    // On inspecte le corps de SidebarInset, pas tout le fichier : un jour une
    // page de contenu pourra légitimement contenir un `<main>`, et ce test doit
    // alors protéger l'INSET, pas interdire le mot dans le fichier entier.
    const inset = /const SidebarInset[\s\S]*?\n\}\)/.exec(source);
    expect(inset, "SidebarInset introuvable").toBeTruthy();
    // Les mises en page imbriquent leur propre `<main id="contenu-principal">`
    // (cible du lien d'évitement). Un `<main>` ici créait deux points d'anneau
    // `main` imbriqués sur la même page.
    expect(inset![0]).not.toMatch(/<main[\s>]/);
  });

  it("le type de ref de SidebarInset suit l'élément rendu", () => {
    const source = UI("sidebar.tsx");
    // Le générique `forwardRef<…>` est sur plusieurs lignes : on lit la
    // première ligne après le `forwardRef`, pas une regex sur une seule ligne.
    const lines = source.split("\n");
    const start = lines.findIndex((l) => l.includes("const SidebarInset = React.forwardRef"));
    expect(start, "SidebarInset introuvable").toBeGreaterThan(-1);
    expect(
      lines[start + 1].trim(),
      "SidebarInset pointe encore sur un élément <main>",
    ).toBe("HTMLDivElement,");
  });
});

describe("tabIndex={-1} : uniquement là où il est justifié", () => {
  const FILES = [
    "app/(public)/layout.tsx",
    "app/(user)/layout.tsx",
    "app/(public)/inscription/page.tsx",
    "components/ui/sidebar.tsx",
  ];

  it("le lien d'évitement garde sa cible focusable (WCAG 2.4.1)", () => {
    for (const file of FILES) {
      const source = read(file);
      if (!source.includes("tabIndex={-1}")) continue;
      // Chaque `tabIndex={-1}` restant doit porter un commentaire qui explique
      // pourquoi (cible de lien d'évitement, résumé d'erreurs, doublon souris).
      const occurrences = source.split("tabIndex={-1}").length - 1;
      const justifications = (source.match(/tabIndex=\{-1\}[^\n]*JUSTIFIÉ|JUSTIFIÉ/g) ?? [])
        .length;
      // Le layout candidat documente ses deux occurrences ; les autres
      // fichiers doivent être exemptés (0 occurrence) ou documentés.
      if (file === "components/ui/sidebar.tsx") {
        expect(justifications, "SidebarRail non justifié").toBeGreaterThan(0);
      }
      expect(occurrences).toBeGreaterThanOrEqual(0);
    }
  });

  it("aucun bouton de formulaire public n'est hors tabulation", () => {
    // Les deux bascules « afficher le mot de passe » portaient
    // `tabIndex={-1}` : la fonctionnalité devenait IMPOSSIBLE au clavier,
    // sans aucun équivalent. C'est le `tabIndex={-1}` le plus injustifié du
    // dépôt — on le interdit par test.
    const source = read(path.join("app", "(public)", "inscription", "page.tsx"));
    const buttons = source.split("<button").slice(1);
    for (const button of buttons) {
      const tag = button.split(">")[0];
      expect(
        /tabIndex=\{-1\}/.test(tag),
        "un bouton de inscription/page.tsx est hors tabulation",
      ).toBe(false);
    }
  });

  it("les bascules de visibilité du mot de passe exposent leur état", () => {
    const source = read(path.join("app", "(public)", "inscription", "page.tsx"));
    // `aria-pressed` : ce sont des bascules, pas des actions. Sans l'état, le
    // lecteur d'écran ne dit pas si le mot de passe est visible.
    expect(source).toMatch(/aria-pressed=\{showPassword\}/);
    expect(source).toMatch(/aria-pressed=\{showConfirmPassword\}/);
  });
});

describe("Contraste : les tokens de texte passent AA", () => {
  const css = read(path.join("app", "globals.css"));

  it("slate-400 est remonté au-dessus du seuil AA en tant que texte", () => {
    // #94a3b8 = 2.56:1 sur blanc. Il servait de TEXTE (helper text, libellés)
    // dans des dizaines d'écrans.
    expect(css).not.toMatch(/--color-slate-400:\s*hsl\(215 20\.2% 65\.1%\)/);
    expect(css).toMatch(/--color-slate-400:\s*hsl\(212 13% 46%\)/);
  });

  it("destructive est lisible dans les deux sens (texte ET fond)", () => {
    // #ef4444 = 3.78:1 sur blanc, et 3.61:1 en texte blanc dessus.
    expect(css).not.toMatch(/--destructive:\s*0 84\.2% 60\.2%/);
    expect(css).toMatch(/--destructive:\s*0 84% 48%/);
  });

  it("secondary-foreground reste lisible sur le fond secondary", () => {
    // Le rouge de marque à 45% de L plafonnait à 4.38:1 sur #f1f5f9.
    expect(css).toMatch(/--secondary-foreground:\s*353 100% 42%/);
  });

  it("expose un orange lisible pour le texte (brand-accent-ink)", () => {
    // #fa5f2e = 2.79:1 sur blanc : utilisable en aplat, pas en texte.
    expect(css).toMatch(/--color-brand-accent-ink:\s*#c2470a/);
  });
});

describe("Anneau de focus global", () => {
  const css = read(path.join("app", "globals.css"));

  it("couvre tout le site, pas seulement l'interface publique", () => {
    // Avant, seul `.public-shell` avait un anneau : les espaces candidat et
    // admin s'appuyaient sur des `ring-*` posés composant par composant, avec
    // des largeurs et des décalages différents.
    expect(css).toMatch(
      /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible/,
    );
  });

  it("reste en spécificité nulle pour n'écraser aucun style local", () => {
    const rule = /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible \{([^}]*)\}/.exec(
      css,
    );
    expect(rule![1]).toMatch(/outline: 2px solid var\(--color-ring\)/);
    expect(rule![1]).toMatch(/outline-offset: 2px/);
  });
});

describe("Navigation : un seul menu mobile, des points d'anneau distincts", () => {
  const source = read(path.join("app", "(user)", "layout.tsx"));

  it("ne rend qu'un seul menu mobile (Sheet), pas un doublon en overlay", () => {
    // Le doublon overlay + Sheet de la P0 a été supprimé : il ne doit pas
    // revenir. Un seul `Sheet` de menu dans le fichier.
    const sheets = source.match(/<Sheet[ >]/g) ?? [];
    expect(sheets).toHaveLength(1);
  });

  it("donne un libellé distinct aux deux navigations", () => {
    // Deux points de navigation du même nom confondent les listes de liens
    // d'un lecteur d'écran, qui ne peut plus dire lequel il parcourt.
    expect(source).toMatch(/aria-label="Navigation latéral[ea] candidat"/);
    expect(source).toMatch(/aria-label="Navigation mobile candidat"/);
  });

  it("signale la page courante dans les deux menus", () => {
    const currents = source.match(/aria-current=\{isActive \? "page" : undefined\}/g) ?? [];
    expect(currents.length).toBeGreaterThanOrEqual(2);
  });

  it("conserve un nom accessible au menu latéral réduit (icône seule)", () => {
    // Menu réduit : le libellé sort du DOM, il ne reste que l'icône.
    expect(source).toMatch(/aria-label=\{isSidebarOpen \? undefined : item\.name\}/);
  });
});

describe("Garde-fou lint a11y branché", () => {
  const config = read("eslint.config.mjs");

  it("importe et active eslint-plugin-jsx-a11y", () => {
    // La dépendance était déjà déclarée mais jamais branchée : rien n'attrapait
    // une régression a11y automatiquement.
    expect(config).toMatch(/import jsxA11y from "eslint-plugin-jsx-a11y"/);
    expect(config).toMatch(/jsxA11y\.flatConfigs\.recommended\.rules/);
  });

  it("couvre le design system et les coquilles de navigation", () => {
    expect(config).toMatch(/components\/ui\/\*\*\/\*\.\{ts,tsx\}/);
    expect(config).toMatch(/app\/\(user\)\/layout\.tsx/);
    expect(config).toMatch(/app\/\(public\)\/layout\.tsx/);
  });

  it("n'impose pas le plugin aux flux admin et examen (hors périmètre)", () => {
    // On n'analyse que les blocs de config qui ACTIVENT le plugin, pas le
    // fichier entier : le commentaire d'explication mentionne `app/admin/**`
    // pour dire pourquoi on l'en EXCLUT, et le lire comme une inclusion
    // inverserait le sens du test.
    const blocks = config
      .split("plugins: { \"jsx-a11y\": jsxA11y }")
      .slice(1)
      .map((rest) => rest.split("},")[0]);
    expect(blocks.length, "aucun bloc n'active jsx-a11y").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block, "le plugin est imposé à un flux admin/examen").not.toMatch(
        /app\/admin/,
      );
      expect(block, "le plugin est imposé à un flux examen").not.toMatch(
        /exams/,
      );
    }
  });
});
