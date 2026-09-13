import { describe, it, expect } from "vitest";
import {
  round2,
  isCorrected,
  resolveExamMax,
  resolveExamMaxFromParts,
  computePart1Score,
  computeFinalScore,
  isPassed,
  resolveMention,
} from "./scoring";

describe("scoring.round2", () => {
  it("arrondit à 2 décimales", () => {
    expect(round2(2.345)).toBe(2.35);
    expect(round2(1.2345)).toBe(1.23);
    expect(round2(10)).toBe(10);
  });

  it("renvoie 0 pour une valeur non finie", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("scoring.isCorrected", () => {
  it("vrai uniquement pour COMPLETED ou GRADED", () => {
    expect(isCorrected("COMPLETED")).toBe(true);
    expect(isCorrected("GRADED")).toBe(true);
  });

  it("faux pour les autres statuts / valeurs absentes", () => {
    expect(isCorrected("IN_PROGRESS")).toBe(false);
    expect(isCorrected("PENDING_REVIEW")).toBe(false);
    expect(isCorrected(null)).toBe(false);
    expect(isCorrected(undefined)).toBe(false);
  });
});

describe("scoring.resolveExamMax", () => {
  it("somme les points des parties activées", () => {
    expect(
      resolveExamMax({ part1Points: 20, part2Points: 30, part3Points: 50 }),
    ).toBe(100);
  });

  it("ignore une partie explicitement désactivée", () => {
    expect(
      resolveExamMax({ part1Enabled: false, part1Points: 20, part2Points: 30 }),
    ).toBe(30);
  });

  it("retombe sur totalPoints si la somme est nulle", () => {
    expect(resolveExamMax({ totalPoints: 80 })).toBe(80);
  });

  it("retombe sur 100 par défaut", () => {
    expect(resolveExamMax({})).toBe(100);
  });
});

describe("scoring.resolveExamMaxFromParts", () => {
  it("somme les points des ExamPart réels (parties multiples)", () => {
    expect(
      resolveExamMaxFromParts([{ points: 20 }, { points: 30 }, { points: 50 }]),
    ).toBe(100);
  });

  it("reste identique quelle que soit la structure (2 QCM + 1 OPEN)", () => {
    // 2 parties QCM (20+30) + 1 OPEN (50) : le max doit être 100,
    // pas 70 (20+50) comme avec les champs legacy partNPoints.
    expect(
      resolveExamMaxFromParts([{ points: 20 }, { points: 30 }, { points: 50 }]),
    ).toBe(100);
  });

  it("retombe sur resolveExamMax si aucune partie", () => {
    expect(
      resolveExamMaxFromParts([], { part1Points: 20, part2Points: 30 }),
    ).toBe(50);
    expect(resolveExamMaxFromParts(null, { totalPoints: 80 })).toBe(80);
    expect(resolveExamMaxFromParts(undefined, undefined)).toBe(100);
  });
});

describe("scoring.computePart1Score", () => {
  it("proportionne les points au nombre de bonnes réponses", () => {
    expect(computePart1Score(5, 10, 20)).toBe(10);
  });

  it("plafonne au nombre total de questions", () => {
    expect(computePart1Score(15, 10, 20)).toBe(20);
  });

  it("plancher à 0 (pas de score négatif)", () => {
    expect(computePart1Score(-3, 10, 20)).toBe(0);
  });

  it("0 si aucune question ou aucun point disponible", () => {
    expect(computePart1Score(5, 0, 20)).toBe(0);
    expect(computePart1Score(5, 10, 0)).toBe(0);
  });
});

describe("scoring.computeFinalScore", () => {
  it("convertit un score brut en pourcentage 0..100", () => {
    expect(computeFinalScore(50, 100)).toBe(50);
    expect(computeFinalScore(13, 20)).toBe(65);
  });

  it("0 si le maximum est <= 0", () => {
    expect(computeFinalScore(10, 0)).toBe(0);
  });
});

describe("scoring.isPassed", () => {
  it("seuil par défaut de 65 %", () => {
    expect(isPassed(65, null)).toBe(true);
    expect(isPassed(64.9, undefined)).toBe(false);
  });

  it("respecte un seuil personnalisé", () => {
    expect(isPassed(70, 80)).toBe(false);
    expect(isPassed(80, 80)).toBe(true);
  });
});

describe("scoring.resolveMention", () => {
  it("90+ → EXCELLENCE", () => {
    expect(resolveMention(90)).toBe("EXCELLENCE");
    expect(resolveMention(100)).toBe("EXCELLENCE");
  });

  it("80-89 → TRES_BIEN", () => {
    expect(resolveMention(80)).toBe("TRES_BIEN");
    expect(resolveMention(89.9)).toBe("TRES_BIEN");
  });

  it("70-79 → BIEN", () => {
    expect(resolveMention(70)).toBe("BIEN");
    expect(resolveMention(79.9)).toBe("BIEN");
  });

  it("65-69 → ASSEZ_BIEN", () => {
    expect(resolveMention(65)).toBe("ASSEZ_BIEN");
    expect(resolveMention(69.9)).toBe("ASSEZ_BIEN");
  });

  it("< 65 → PASSABLE", () => {
    expect(resolveMention(64.9)).toBe("PASSABLE");
    expect(resolveMention(0)).toBe("PASSABLE");
  });
});
