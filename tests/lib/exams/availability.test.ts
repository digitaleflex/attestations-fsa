import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: { updateMany: db.examUpdateMany },
  },
}));

import {
  VISIBLE_EXAM_STATUSES,
  getExamOpensOn,
  isExamAvailable,
  isExamVisible,
  autoOpenDueExams,
} from "../../../lib/exams/availability";

const NOW = new Date("2026-09-13T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("availability.VISIBLE_EXAM_STATUSES", () => {
  it("expose uniquement SCHEDULED et PUBLISHED", () => {
    expect(VISIBLE_EXAM_STATUSES).toEqual(["SCHEDULED", "PUBLISHED"]);
  });
});

describe("availability.isExamAvailable", () => {
  it("PUBLISHED avec date passée → disponible", () => {
    expect(
      isExamAvailable(
        { status: "PUBLISHED", scheduledAt: new Date("2026-09-01T08:00:00Z") },
        NOW,
      ),
    ).toBe(true);
  });

  it("PUBLISHED sans date → indisponible", () => {
    expect(
      isExamAvailable({ status: "PUBLISHED", scheduledAt: null }, NOW),
    ).toBe(false);
  });

  it("PUBLISHED avec date future → indisponible", () => {
    expect(
      isExamAvailable(
        { status: "PUBLISHED", scheduledAt: new Date("2099-01-01") },
        NOW,
      ),
    ).toBe(false);
  });

  it("SCHEDULED passé → disponible", () => {
    expect(
      isExamAvailable(
        { status: "SCHEDULED", scheduledAt: new Date("2026-09-01T08:00:00Z") },
        NOW,
      ),
    ).toBe(true);
  });

  it("SCHEDULED futur → indisponible", () => {
    expect(
      isExamAvailable(
        { status: "SCHEDULED", scheduledAt: new Date("2026-09-20T08:00:00Z") },
        NOW,
      ),
    ).toBe(false);
  });

  it("SCHEDULED sans date → indisponible", () => {
    expect(
      isExamAvailable({ status: "SCHEDULED", scheduledAt: null }, NOW),
    ).toBe(false);
  });

  it("DRAFT / ARCHIVED → jamais disponible", () => {
    expect(isExamAvailable({ status: "DRAFT", scheduledAt: null }, NOW)).toBe(
      false,
    );
    expect(
      isExamAvailable({ status: "ARCHIVED", scheduledAt: null }, NOW),
    ).toBe(false);
  });
});

describe("availability — visibilité jour J (M9)", () => {
  // J = 2026-09-25 à Porto-Novo → minuit J = 2026-09-24T23:00:00Z.
  const OPEN_J = new Date("2026-09-24T23:00:00Z");
  const scheduled = new Date("2026-09-25T08:00:00Z"); // 09:00 locale

  it("J-1 : verrouillé même si l'heure prévue est imminente", () => {
    expect(
      isExamVisible(
        { status: "SCHEDULED", opensOn: OPEN_J, scheduledAt: scheduled },
        new Date("2026-09-24T22:59:59Z"),
      ),
    ).toBe(false);
  });

  it("J : visible dès 00:00:00 Africa/Porto-Novo", () => {
    expect(
      isExamVisible(
        { status: "SCHEDULED", opensOn: OPEN_J, scheduledAt: scheduled },
        new Date("2026-09-24T23:00:00Z"),
      ),
    ).toBe(true);
  });

  it("J : visible avant l'heure prévue, mais non démarrable", () => {
    const beforeStart = new Date("2026-09-25T07:00:00Z");
    expect(
      isExamVisible(
        { status: "SCHEDULED", opensOn: OPEN_J, scheduledAt: scheduled },
        beforeStart,
      ),
    ).toBe(true);
    expect(
      isExamAvailable(
        { status: "SCHEDULED", opensOn: OPEN_J, scheduledAt: scheduled },
        beforeStart,
      ),
    ).toBe(false);
  });

  it("opensOn > scheduledAt incohérent : verrouillé jusqu'à opensOn", () => {
    const lateOpensOn = new Date("2026-09-26T08:00:00Z");
    expect(
      isExamVisible(
        { status: "PUBLISHED", opensOn: lateOpensOn, scheduledAt: scheduled },
        new Date("2026-09-25T09:00:00Z"),
      ),
    ).toBe(false);
  });

  it("J+1 : toujours visible (pas de re-fermeture à J+1)", () => {
    expect(
      isExamVisible(
        { status: "PUBLISHED", opensOn: OPEN_J, scheduledAt: scheduled },
        new Date("2026-09-26T09:00:00Z"),
      ),
    ).toBe(true);
  });

  it("DRAFT / ARCHIVED : jamais visibles", () => {
    expect(
      isExamVisible(
        { status: "DRAFT", opensOn: OPEN_J, scheduledAt: scheduled },
        new Date("2026-09-25T09:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isExamVisible(
        { status: "ARCHIVED", opensOn: OPEN_J, scheduledAt: scheduled },
        new Date("2026-09-25T09:00:00Z"),
      ),
    ).toBe(false);
  });

  it("examens existants (opensOn null) : repli sur le jour local de scheduledAt", () => {
    const exam = { status: "PUBLISHED", opensOn: null, scheduledAt: scheduled };
    expect(getExamOpensOn(exam)?.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    // 2026-09-24T22:00Z = 23:00 locale du 24/09 → veille de J → verrouillé.
    expect(isExamVisible(exam, new Date("2026-09-24T22:00:00Z"))).toBe(false);
    expect(isExamVisible(exam, new Date("2026-09-24T23:30:00Z"))).toBe(true);
  });

  it("sans opensOn ni scheduledAt : jamais visible", () => {
    expect(
      isExamVisible({ status: "PUBLISHED", opensOn: null, scheduledAt: null }, NOW),
    ).toBe(false);
  });

  it("le fuseau de la machine ne change pas la visibilité (J = 00:00 Porto-Novo)", () => {
    const exam = { status: "SCHEDULED", opensOn: OPEN_J, scheduledAt: scheduled };
    const previous = process.env.TZ;
    try {
      for (const tz of ["UTC", "Asia/Tokyo", "America/New_York"]) {
        process.env.TZ = tz;
        expect(isExamVisible(exam, new Date("2026-09-24T22:59:59Z"))).toBe(false);
        expect(isExamVisible(exam, new Date("2026-09-24T23:00:00Z"))).toBe(true);
      }
    } finally {
      process.env.TZ = previous;
    }
  });
});

describe("availability.autoOpenDueExams", () => {
  it("bascule les SCHEDULED échus en PUBLISHED", async () => {
    db.examUpdateMany.mockResolvedValue({ count: 2 } as never);
    const result = await autoOpenDueExams(NOW);
    expect(result).toEqual({ count: 2 });
    expect(db.examUpdateMany).toHaveBeenCalledWith({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: NOW },
      },
      data: { status: "PUBLISHED" },
    });
  });
});
