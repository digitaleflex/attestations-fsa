import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Garde-fous accessibilité de l'espace candidat (P1/P2).
 *
 * Ces règles ont été corrigées à la main sur les pages candidat ; ce test les
 * fige pour empêcher une régression silencieuse. Aucune base ni aucun rendu
 * n'est requis : lecture de fichiers uniquement (même approche que
 * `credential-account-convention.test.ts`).
 *
 * Périmètre : `app/(user)/` SAUF `exams` (examens), et hors builder admin.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** Fichiers `.tsx` de l'espace candidat, examens exclus. */
function candidateFiles(): string[] {
  const base = path.join(ROOT, "app", "(user)");
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "exams") continue; // hors périmètre
        walk(full);
      } else if (entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  };

  walk(base);
  return out.sort();
}

const CANDIDATE_FILES = candidateFiles();

describe("Périmètre des garde-fous", () => {
  it("la page layout candidate est bien incluse, les examens exclus", () => {
    const rel = CANDIDATE_FILES.map((f) => path.relative(ROOT, f));
    expect(rel).toContain(path.join("app", "(user)", "layout.tsx"));
    expect(rel).toContain(path.join("app", "(user)", "results", "page.tsx"));
    expect(rel.some((f) => f.includes(`${path.sep}exams${path.sep}`))).toBe(false);
  });
});

describe("P1 — États de données de l'espace candidat", () => {
  it("CandidateStates expose un composant d'ERREUR distinct de l'état vide", () => {
    const source = read(path.join("components", "CandidateStates.tsx"));
    // Deux composants séparés : impossible de confondre une panne et un vide.
    expect(source).toContain("export function CandidateErrorState");
    expect(source).toContain("export function CandidateEmptyState");
    // L'erreur est une `alert` (urgente), l'état vide un `status` (poli).
    expect(source).toMatch(/role="alert"/);
    // L'erreur propose toujours un retry.
    expect(source).toMatch(/Réessayer/);
    expect(source).toMatch(/onClick=\{onRetry\}/);
  });

  it("CandidateLoading est annoncé (role=status) et marque aria-busy", () => {
    const source = read(path.join("components", "CandidateStates.tsx"));
    const loading = source.slice(
      source.indexOf("export function CandidateLoading"),
      source.indexOf("export interface CandidateErrorStateProps"),
    );
    expect(loading).toMatch(/role="status"/);
    expect(loading).toMatch(/aria-live="polite"/);
    expect(loading).toMatch(/aria-busy="true"/);
  });

  it("ScoreProgressBar expose role/valuemin/valuemax/valuenow", () => {
    const source = read(path.join("components", "CandidateStates.tsx"));
    const bar = source.slice(source.indexOf("export function ScoreProgressBar"));
    expect(bar).toMatch(/role="progressbar"/);
    expect(bar).toMatch(/aria-valuemin=\{0\}/);
    expect(bar).toMatch(/aria-valuemax=\{100\}/);
    expect(bar).toMatch(/aria-valuenow=\{safeValue\}/);
    // Nom accessible obligatoire : une barre anonyme n'est pas annoncée.
    expect(bar).toMatch(/aria-label=\{label\}/);
  });

  const PAGES_WITH_DATA = [
    path.join("app", "(user)", "dashboard", "page.tsx"),
    path.join("app", "(user)", "results", "page.tsx"),
    path.join("app", "(user)", "results", "[id]", "page.tsx"),
    path.join("app", "(user)", "attestations", "page.tsx"),
    path.join("app", "(user)", "attestations", "[id]", "page.tsx"),
    path.join("app", "(user)", "internships", "page.tsx"),
    path.join("app", "(user)", "notifications", "page.tsx"),
    path.join("app", "(user)", "profile", "page.tsx"),
  ];

  it.each(PAGES_WITH_DATA)("%s gère l'erreur réseau avec un retry", (file) => {
    const source = read(file);
    expect(source, `${file} n'utilise pas CandidateErrorState`).toContain(
      "CandidateErrorState",
    );
    // Le retry doit être branché sur `refetch`, pas juste présent visuellement.
    expect(source, `${file} ne relance pas la requête`).toMatch(/refetch/);
  });

  it.each(PAGES_WITH_DATA)(
    "%s ne masque plus une erreur réseau derrière un état vide",
    (file) => {
      const source = read(file);
      // Interdit : renvoyer un objet vide quand la requête échoue.
      expect(
        /if\s*\(!res\.ok\)\s*return\s*\{\s*notifications:\s*\[\]/.test(source),
        `${file} avale l'erreur réseau et affiche un faux état vide`,
      ).toBe(false);
    },
  );

  it("la page résultats distingue 404 (vide) et erreur réseau", () => {
    const source = read(path.join("app", "(user)", "results", "[id]", "page.tsx"));
    expect(source).toContain("not-found");
    expect(source).toContain("CandidateEmptyState");
    expect(source).toContain("CandidateErrorState");
  });

  it("la page attestation distingue 404 (vide) et erreur réseau", () => {
    const source = read(
      path.join("app", "(user)", "attestations", "[id]", "page.tsx"),
    );
    expect(source).toContain("AttestationNotFoundError");
    expect(source).toContain("CandidateEmptyState");
    expect(source).toContain("CandidateErrorState");
  });

  it("les pages à filtres ne confondent pas « aucun résultat » et « filtre restrictif »", () => {
    const attestations = read(
      path.join("app", "(user)", "attestations", "page.tsx"),
    );
    expect(attestations).toMatch(/hasActiveFilters/);
    // Deux libellés distincts, pas un seul « aucune attestation ».
    expect(attestations).toContain("Vous n'avez pas encore d'attestation");
    expect(attestations).toContain("ne correspond à vos filtres");

    const internships = read(path.join("app", "(user)", "internships", "page.tsx"));
    expect(internships).toContain("Aucune candidature envoyée");
    expect(internships).toContain("Aucune candidature avec ce statut");
  });
});

describe("P1 — Barres de progression des résultats", () => {
  const RESULT_PAGES = [
    path.join("app", "(user)", "results", "page.tsx"),
    path.join("app", "(user)", "results", "[id]", "page.tsx"),
  ];

  it.each(RESULT_PAGES)("%s utilise ScoreProgressBar", (file) => {
    expect(read(file)).toContain("ScoreProgressBar");
  });

  it.each(RESULT_PAGES)(
    "%s n'a plus de barre de progression écrite à la main",
    (file) => {
      const source = read(file);
      // Une piste `overflow-hidden` + `width: %` sans role=progressbar est
      // exactement le motif corrigé.
      expect(source).not.toMatch(/overflow-hidden["'`][^\n]*\n?[\s\S]{0,400}?style=\{\{\s*width:/);
    },
  );

  it("le composant ui/progress borne la valeur et pose un nom accessible", () => {
    const source = read(path.join("components", "ui", "progress.tsx"));
    expect(source).toMatch(/aria-label=/);
    expect(source).toMatch(/aria-valuetext=/);
    expect(source).toMatch(/max = 100/);
  });
});

describe("P1 — Squelettes de chargement", () => {
  const source = read(path.join("components", "SkeletonLoader.tsx"));

  it("chaque squelette est une région status annoncée", () => {
    const regions = source.match(/role="status"/g) ?? [];
    // SkeletonRegion (utilisée par SkeletonCard et SkeletonStats) + SkeletonList.
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(source).toMatch(/aria-live="polite"/);
    expect(source).toMatch(/aria-busy="true"/);
    // Les rectangles décoratifs ne doivent pas être lus.
    expect(source).toMatch(/aria-hidden="true"/);
    // Un libellé textuel par squelette.
    expect(source).toMatch(/sr-only/);
  });
});

describe("P2 — Contrastes des pages candidat", () => {
  it("aucune page candidat ne garde text-slate-300 / text-slate-400", () => {
    const offenders: string[] = [];

    for (const file of CANDIDATE_FILES) {
      const source = fs.readFileSync(file, "utf8");
      source.split("\n").forEach((line, i) => {
        // slate-300 (#cbd5e1) ≈ 1,6:1 et slate-400 (#94a3b8) ≈ 2,8:1 sur
        // fond blanc : tous deux sous le seuil AA (4,5:1) pour du texte.
        if (/\btext-slate-(300|400)\b/.test(line)) {
          offenders.push(
            `${path.relative(ROOT, file)}:${i + 1} — ${line.trim().slice(0, 90)}`,
          );
        }
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("aucun texte blanc à faible opacité dans l'espace candidat", () => {
    const offenders: string[] = [];

    for (const file of CANDIDATE_FILES) {
      const source = fs.readFileSync(file, "utf8");
      source.split("\n").forEach((line, i) => {
        // white/60, white/70, white/80 sur fond sombre ou rouge : sous 4,5:1.
        if (/\btext-white\/(40|50|60|70|80)\b/.test(line)) {
          offenders.push(
            `${path.relative(ROOT, file)}:${i + 1} — ${line.trim().slice(0, 90)}`,
          );
        }
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("les composants partagés corrigés n'introduisent pas de retour en arrière", () => {
    for (const file of [
      path.join("components", "CandidateStates.tsx"),
      path.join("components", "SkeletonLoader.tsx"),
    ]) {
      const source = read(file);
      expect(source, `${file} réintroduit un gris trop clair`).not.toMatch(
        /\btext-slate-(200|300|400)\b/,
      );
    }
  });
});

describe("P2 — Lien d'évitement et cible du contenu principal", () => {
  it("le lien d'évitement pointe vers #contenu-principal", () => {
    const root = read(path.join("app", "layout.tsx"));
    expect(root).toMatch(/href="#contenu-principal"/);
    expect(root).toMatch(/className="skip-link"/);
  });

  it("chaque layout de groupe expose un <main id=contenu-principal> focusable", () => {
    for (const file of [
      path.join("app", "(public)", "layout.tsx"),
      path.join("app", "(user)", "layout.tsx"),
    ]) {
      const source = read(file);
      expect(source, `${file} n'a pas la cible du lien d'évitement`).toMatch(
        /<main[\s\S]{0,400}id="contenu-principal"/,
      );
      // Cible de défilement, pas un élément tabulable : tabIndex=-1.
      expect(source, `${file} : la cible n'est pas focusable au clavier`).toMatch(
        /id="contenu-principal"[\s\S]{0,200}tabIndex=\{-1\}/,
      );
    }
  });
});
