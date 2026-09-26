/**
 * Non-régression — aucune fuite de contenu d'un examen AVANT son ouverture.
 *
 * Spécification : docs/specs/2026-09-25-exam-scheduling-design.md
 *   - « aucune description, aucun barème, aucune durée, aucun nombre de
 *      questions et aucun contenu ne sont renvoyés » avant le jour J ;
 *   - seuls l'identifiant, le titre, la date d'ouverture, l'heure prévue et
 *     le compte à rebours peuvent être exposés ;
 *   - `GET`, `start`, `draft` et `submit` refusent l'accès avec 423 EXAM_LOCKED ;
 *   - l'API publique ne déclenche plus de mutation.
 *
 * Trois surfaces publiques sont couvertes :
 *   1. GET /api/exams/[id]            → 423 EXAM_LOCKED, corps sans contenu
 *   2. GET /api/exams/scheduled        → forme réduite (annonces)
 *   3. getPublicUpcomingExams()        → forme réduite pour les examens futurs
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  examFindUnique: vi.fn(),
  examFindMany: vi.fn(),
  examUpdateMany: vi.fn(),
  enrollmentFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exam: {
      findUnique: db.examFindUnique,
      findMany: db.examFindMany,
      updateMany: db.examUpdateMany,
    },
    examEnrollment: { findUnique: db.enrollmentFindUnique },
  },
}));

const deps = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminUser: vi.fn(),
  applyRateLimit: vi.fn(),
  applyRateLimitByUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: deps.getCurrentUser,
  getAdminUser: deps.getAdminUser,
}));
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: deps.applyRateLimit,
  applyRateLimitByUser: deps.applyRateLimitByUser,
}));

// `unstable_cache` rendu transparent : on teste la forme renvoyée, pas le cache.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

import { GET as getExam } from "../../app/api/exams/[id]/route";
import { GET as getScheduled } from "../../app/api/exams/scheduled/route";
import { getPublicUpcomingExams } from "../../lib/data-public";

/**
 * Examen planifié mais NON ouvert. Les dates sont volontairement lointaines
 * (2099) : ces tests doivent rester valides quelle que soit la date réelle à
 * laquelle la suite est exécutée.
 */
const FUTURE_OPENS_ON = new Date("2098-12-31T23:00:00Z"); // minuit local
const FUTURE_SCHEDULED_AT = new Date("2099-01-01T07:00:00Z"); // 08:00 locale
const FUTURE_EXAM = {
  id: "exam-future",
  title: "Examen blanc de septembre",
  name: "Examen blanc de septembre",
  description: "SECRET- description détaillée du barème",
  status: "SCHEDULED",
  type: "OFFICIAL",
  totalPoints: 100,
  passingScore: 65,
  duration: 3600,
  part1Enabled: true,
  part1Points: 20,
  part1Questions: 20,
  part2Enabled: true,
  part2Points: 40,
  part2Questions: 5,
  part3Enabled: true,
  part3Points: 40,
  formationId: "formation-1",
  randomizeQuestions: false,
  showResults: false,
  opensOn: FUTURE_OPENS_ON,
  scheduledAt: FUTURE_SCHEDULED_AT,
  parts: [
    {
      id: "part-1",
      examId: "exam-future",
      title: "QCM",
      type: "QCM",
      duration: 30,
      points: 20,
      order: 1,
      scenario: "SECRET- scénario",
      questions: [
        {
          id: "q1",
          partId: "part-1",
          text: "SECRET- texte de question",
          type: "SINGLE_CHOICE",
          points: 1,
          order: 1,
          options: [{ id: "o1", text: "Bonne réponse" }],
        },
      ],
    },
  ],
};

const FORBIDDEN_KEYS = [
  "description",
  "passingScore",
  "totalPoints",
  "duration",
  "part1Questions",
  "part2Questions",
  "parts",
  "questions",
];

const params = { params: Promise.resolve({ id: "exam-future" }) };

function callGetExam() {
  return getExam(
    new Request("http://localhost/api/exams/exam-future"),
    params,
  );
}

function callGetScheduled() {
  return getScheduled(new Request("http://localhost/api/exams/scheduled"));
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.getCurrentUser.mockResolvedValue({ id: "user-1" } as never);
  deps.getAdminUser.mockResolvedValue(null as never);
  deps.applyRateLimit.mockResolvedValue({ allowed: true } as never);
  deps.applyRateLimitByUser.mockResolvedValue({ allowed: true } as never);
  db.enrollmentFindUnique.mockResolvedValue({
    id: "enrollment-1",
    status: "ACTIVE",
  } as never);
  db.examUpdateMany.mockResolvedValue({ count: 0 } as never);
  db.examFindUnique.mockResolvedValue(FUTURE_EXAM as never);
  db.examFindMany.mockResolvedValue([] as never);
});

describe("GET /api/exams/[id] — examen non ouvert", () => {
  it("423 EXAM_LOCKED pour un examen dont la journée d'ouverture est future", async () => {
    const res = await callGetExam();
    expect(res.status).toBe(423);
    expect((await res.json()).code).toBe("EXAM_LOCKED");
  });

  it("le corps du refus ne contient aucun contenu d'examen", async () => {
    const res = await callGetExam();
    const body = await res.json();
    const serialized = JSON.stringify(body);
    for (const key of FORBIDDEN_KEYS) {
      expect(body).not.toHaveProperty(key);
    }
    expect(serialized).not.toContain("SECRET-");
    expect(serialized).not.toContain("q1");
    expect(serialized).not.toContain("o1");
  });

  it("aucune inscription lue ni aucune mutation déclenchée", async () => {
    await callGetExam();
    expect(db.enrollmentFindUnique).not.toHaveBeenCalled();
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("un admin conserve la prévisualisation (aperçu avant ouverture)", async () => {
    deps.getAdminUser.mockResolvedValue({ id: "admin-1" } as never);
    const res = await callGetExam();
    expect(res.status).toBe(200);
  });

  it("un examen inexistant répond 404, pas 423", async () => {
    db.examFindUnique.mockResolvedValue(null as never);
    const res = await callGetExam();
    expect(res.status).toBe(404);
  });

  it("une session déjà commencée n'ouvre pas droit au contenu", async () => {
    // Le contrôle de disponibilité passe AVANT toute logique de session.
    db.examFindUnique.mockResolvedValue({
      ...FUTURE_EXAM,
      scheduledAt: new Date(Date.now() - 60_000), // échéance déjà atteinte
      opensOn: new Date(Date.now() + 5 * 24 * 3600 * 1000), // mais J+5
    } as never);
    const res = await callGetExam();
    expect(res.status).toBe(423);
  });
});

describe("GET /api/exams/scheduled — annonces publiques", () => {
  it("forme réduite : aucune description, durée, barème ni questions", async () => {
    db.examFindMany.mockResolvedValue([FUTURE_EXAM] as never);
    const res = await callGetScheduled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exams).toHaveLength(1);
    const [exam] = body.exams;
    for (const key of FORBIDDEN_KEYS) {
      expect(exam).not.toHaveProperty(key);
    }
    expect(JSON.stringify(body)).not.toContain("SECRET-");
  });

  it("conserve l'identifiant, le titre, la date d'ouverture et l'heure prévue", async () => {
    db.examFindMany.mockResolvedValue([FUTURE_EXAM] as never);
    const res = await callGetScheduled();
    const [exam] = (await res.json()).exams;
    expect(exam.id).toBe("exam-future");
    expect(exam.title).toBeTruthy();
    expect(exam.scheduledAt).toBeTruthy();
    expect(exam.opensOn).toBeTruthy();
    // Champs de planning seuls : le compte à rebours se calcule dessus.
    expect(exam.status).toBe("SCHEDULED");
  });

  it("la route publique ne déclenche plus de mutation (lazy-open retiré)", async () => {
    db.examFindMany.mockResolvedValue([FUTURE_EXAM] as never);
    const res = await callGetScheduled();
    expect(res.status).toBe(200);
    expect(db.examUpdateMany).not.toHaveBeenCalled();
  });

  it("n'annonce jamais un examen DRAFT ou ARCHIVED", async () => {
    await callGetScheduled();
    const args = db.examFindMany.mock.calls[0][0] as {
      where: { status: { in?: string[] } | string };
    };
    const statusFilter = args.where.status as { in?: string[] } | string;
    const selected =
      typeof statusFilter === "string" ? [statusFilter] : (statusFilter.in ?? []);
    expect(selected).toContain("SCHEDULED");
    expect(selected).not.toContain("DRAFT");
    expect(selected).not.toContain("ARCHIVED");
  });
});

describe("getPublicUpcomingExams — forme réduite avant ouverture", () => {
  const OPEN_EXAM = {
    ...FUTURE_EXAM,
    id: "exam-open",
    status: "PUBLISHED",
    scheduledAt: new Date("2026-09-01T07:00:00Z"),
    opensOn: new Date("2026-08-31T23:00:00Z"),
  };

  it("un examen futur est renvoyé sans description, durée, barème ni questions", async () => {
    db.examFindMany.mockResolvedValue([FUTURE_EXAM, OPEN_EXAM] as never);
    const exams = await getPublicUpcomingExams(3);
    const future = exams.find((e) => e.id === "exam-future");
    expect(future).toBeDefined();
    for (const key of FORBIDDEN_KEYS) {
      expect(future).not.toHaveProperty(key);
    }
  });

  it("les champs de planning restent exposés (countdown alimenté)", async () => {
    db.examFindMany.mockResolvedValue([FUTURE_EXAM] as never);
    const [future] = await getPublicUpcomingExams(3);
    expect(future.scheduledAt).toBeTruthy();
    expect(future.opensOn).toBeTruthy();
    expect(future.id).toBe("exam-future");
    expect(future.title).toBeTruthy();
  });

  it("un examen déjà ouvert conserve ses informations publiques", async () => {
    db.examFindMany.mockResolvedValue([OPEN_EXAM] as never);
    const [open] = await getPublicUpcomingExams(3);
    expect(open.duration).toBe(3600);
  });

  it("la sélection SQL ne demande jamais les questions ni le barème", async () => {
    db.examFindMany.mockResolvedValue([] as never);
    await getPublicUpcomingExams(3);
    const args = db.examFindMany.mock.calls[0][0] as {
      select: Record<string, boolean>;
    };
    const selected = Object.keys(args.select);
    for (const forbidden of [
      "parts",
      "questions",
      "passingScore",
      "totalPoints",
      "part1Questions",
    ]) {
      expect(selected).not.toContain(forbidden);
    }
  });
});
