import { describe, it, expect } from "vitest";
import {
  round2,
  isCorrected,
  resolveExamMax,
  computePart1Score,
  computeFinalScore,
  isPassed,
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
