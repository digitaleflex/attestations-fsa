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

/**
 * Shape d'examen porteuse de `opensOn` (champ ajouté par la spécification
 * planning). Le passage par une variable évite l'excess-property check tant que
 * `isExamAvailable` n'a pas encore widened sa signature : ces cas doivent
 * compiler AVANT comme APRÈS l'implémentation.
 */
type ScheduledExamShape = {
  status: string;
  scheduledAt: Date | null;
  opensOn?: Date | null;
};

function exam(shape: ScheduledExamShape) {
  return shape as Parameters<typeof isExamAvailable>[0];
}

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

// ---------------------------------------------------------------------------
// Non-régression planning — journée d'ouverture `opensOn`
// (docs/specs/2026-09-25-exam-scheduling-design.md)
//
// Repères, tous exprimés en UTC pour un fuseau de référence
// Africa/Porto-Novo (UTC+1) :
//   J        = 2026-09-25 (local)  → minuit local = 2026-09-24T23:00:00Z
//   scheduledAt = 2026-09-25 08:00 (local) = 2026-09-25T07:00:00Z
// ---------------------------------------------------------------------------
const OPENS_ON = new Date("2026-09-24T23:00:00Z"); // minuit du jour J, local
const SCHEDULED_AT = new Date("2026-09-25T07:00:00Z"); // 08:00 locale, jour J

describe("availability — journée d'ouverture (opensOn)", () => {
  it("J-1 : verrouillé même si le statut est PUBLISHED", () => {
    const jMinus1 = new Date("2026-09-24T12:00:00Z"); // 13:00 le 24, local
    expect(
      isExamAvailable(
        exam({
          status: "PUBLISHED",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        jMinus1,
      ),
    ).toBe(false);
  });

  it("J : visible mais verrouillé avant scheduledAt (minuit local passé)", () => {
    const justAfterMidnight = new Date("2026-09-24T23:30:00Z"); // 00:30 le 25
    expect(
      isExamAvailable(
        exam({
          status: "SCHEDULED",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        justAfterMidnight,
      ),
    ).toBe(false);
  });

  it("J : disponible exactement à scheduledAt (comparaison inclusive)", () => {
    expect(
      isExamAvailable(
        exam({
          status: "SCHEDULED",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        SCHEDULED_AT,
      ),
    ).toBe(true);
  });

  it("J+1 : toujours disponible", () => {
    expect(
      isExamAvailable(
        exam({
          status: "PUBLISHED",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        new Date("2026-09-26T08:00:00Z"),
      ),
    ).toBe(true);
  });

  it("opensOn dans le futur prime sur un scheduledAt déjà échu", () => {
    // Données incohérentes (ne doivent pas exister) : on refuse d'ouvrir.
    // Aucune fuite possible même si le cron a déjà basculé le statut.
    expect(
      isExamAvailable(
        exam({
          status: "PUBLISHED",
          scheduledAt: new Date("2026-09-01T07:00:00Z"),
          opensOn: new Date("2026-12-24T23:00:00Z"),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("opensOn null → repli sur la date locale de scheduledAt", () => {
    const shape = exam({
      status: "PUBLISHED",
      scheduledAt: SCHEDULED_AT,
      opensOn: null,
    });
    // Avant l'échéance : verrouillé.
    expect(isExamAvailable(shape, new Date("2026-09-24T12:00:00Z"))).toBe(false);
    // Après l'échéance : disponible.
    expect(isExamAvailable(shape, new Date("2026-09-26T08:00:00Z"))).toBe(true);
  });

  it("opensOn absent de la sélection (repli) ne déverrouille rien", () => {
    expect(
      isExamAvailable(
        exam({ status: "PUBLISHED", scheduledAt: null }),
        new Date("2026-09-26T08:00:00Z"),
      ),
    ).toBe(false);
  });

  it("ARCHIVED reste verrouillé même après l'ouverture", () => {
    expect(
      isExamAvailable(
        exam({
          status: "ARCHIVED",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        new Date("2026-09-26T08:00:00Z"),
      ),
    ).toBe(false);
  });

  it("DRAFT reste verrouillé même après l'ouverture", () => {
    expect(
      isExamAvailable(
        exam({
          status: "DRAFT",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        new Date("2026-09-26T08:00:00Z"),
      ),
    ).toBe(false);
  });

  it("une seconde d'avance suffit à déverrouiller", () => {
    expect(
      isExamAvailable(
        exam({
          status: "SCHEDULED",
          scheduledAt: SCHEDULED_AT,
          opensOn: OPENS_ON,
        }),
        new Date(SCHEDULED_AT.getTime() - 1_000),
      ),
    ).toBe(false);
  });
});
