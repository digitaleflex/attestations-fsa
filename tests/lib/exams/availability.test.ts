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
  isExamAvailable,
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
