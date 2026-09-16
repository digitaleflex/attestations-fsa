import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  sessionFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    examSession: { findMany: db.sessionFindMany },
  },
}));

import { analyzeAnswerPattern } from "../../lib/anti-cheat";

function stubOtherSessions(sessions: Record<string, unknown>[]) {
  db.sessionFindMany.mockResolvedValue(sessions as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeAnswerPattern — faux positifs (#129)", () => {
  it("deux copies vides → aucun flag (0 clé ≠ identiques)", async () => {
    stubOtherSessions([
      { userId: "user-2", answers: {}, submittedAt: new Date() },
    ]);
    const result = await analyzeAnswerPattern({}, "exam-1", "user-1");
    expect(result.isSuspicious).toBe(false);
    expect(result.flags).toHaveLength(0);
  });

  it("une copie de 11 réponses correctes → aucun flag (seuil >10 supprimé)", async () => {
    const answers: Record<string, string> = {};
    for (let i = 0; i < 11; i++) answers[`q${i}`] = `o${i}`;
    stubOtherSessions([
      {
        userId: "user-2",
        answers: { q0: "x", q1: "y" },
        submittedAt: new Date(),
      },
    ]);
    const result = await analyzeAnswerPattern(answers, "exam-1", "user-1");
    expect(result.isSuspicious).toBe(false);
    expect(result.flags).toHaveLength(0);
  });

  it("petit échantillon commun (< 5) → pas de flag similarité", async () => {
    stubOtherSessions([
      {
        userId: "user-2",
        // 5 clés dont 3 communes avec la copie courante, toutes identiques
        answers: { q1: "a", q2: "b", q3: "c", q9: "z", q10: "z" },
        submittedAt: new Date(),
      },
    ]);
    // 3 réponses communes, toutes identiques → similarité 1.0 mais échantillon < 5
    const result = await analyzeAnswerPattern(
      { q1: "a", q2: "b", q3: "c" },
      "exam-1",
      "user-1",
    );
    expect(result.isSuspicious).toBe(false);
  });

  it("copies réellement identiques (échantillon suffisant) → flag CRITICAL", async () => {
    const answers: Record<string, string> = {};
    for (let i = 0; i < 10; i++) answers[`q${i}`] = `o${i}`;
    stubOtherSessions([
      { userId: "user-2", answers: { ...answers }, submittedAt: new Date() },
    ]);
    const result = await analyzeAnswerPattern(answers, "exam-1", "user-1");
    expect(result.isSuspicious).toBe(true);
    expect(result.flags[0].type).toBe("IDENTICAL_ANSWERS");
    expect(result.flags[0].severity).toBe("CRITICAL");
  });

  it("similarité élevée sur échantillon suffisant (≥ 5) → flag HIGH", async () => {
    const mine: Record<string, string> = {};
    const other: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      mine[`q${i}`] = `o${i}`;
      other[`q${i}`] = `o${i}`; // 10/10 communes identiques
    }
    other.q99 = "extra"; // clé en plus → le check « identique » est sauté
    stubOtherSessions([
      { userId: "user-2", answers: other, submittedAt: new Date() },
    ]);
    const result = await analyzeAnswerPattern(mine, "exam-1", "user-1");
    expect(result.isSuspicious).toBe(true);
    expect(result.flags.some((f) => f.type === "ANSWER_PATTERN_MATCH")).toBe(
      true,
    );
  });
});
