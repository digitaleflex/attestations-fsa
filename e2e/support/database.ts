/**
 * Oracle de lecture pour les tests E2E.
 *
 * Les tests lisent la base E2E directement pour connaître :
 *  - l'identifiant de l'examen semé et la clé de réponses correctes
 *    (jamais exposée par l'API — cf. `app/api/exams/[id]/route.ts`) ;
 *  - l'attestation de certification réellement émise par le flux applicatif.
 *
 * Aucune écriture ici : la base est préparée par `e2e/setup/global-setup.ts`.
 */
import { withE2eDb } from "../setup/db";
import {
  E2E_EXAM_NAME,
  E2E_LOCKED_EXAM_NAME,
  E2E_UI_EXAM_NAME,
} from "../setup/seed";
import { CANDIDATE_EMAIL } from "../setup/env";

export interface SeededQuestion {
  id: string;
  text: string;
  correctOptionId: string;
}

export interface SeededExam {
  id: string;
  name: string;
  questions: SeededQuestion[];
}

export async function getSeededExam(): Promise<SeededExam> {
  return withE2eDb(async (prisma) => {
    const exam = await prisma.exam.findFirst({
      where: { name: E2E_EXAM_NAME },
      select: { id: true, name: true },
    });
    if (!exam) {
      throw new Error(
        `[e2e] Examen semé "${E2E_EXAM_NAME}" introuvable. Le globalSetup a-t-il tourné ?`,
      );
    }

    const questions = await prisma.question.findMany({
      where: { part: { examId: exam.id, type: "QCM" } },
      orderBy: { order: "asc" },
      select: {
        id: true,
        text: true,
        options: { select: { id: true, isCorrect: true } },
      },
    });

    return {
      id: exam.id,
      name: exam.name,
      questions: questions.map((question) => {
        const correct = question.options.find((option) => option.isCorrect);
        if (!correct) {
          throw new Error(
            `[e2e] Question ${question.id} sans option correcte dans le seed.`,
          );
        }
        return {
          id: question.id,
          text: question.text,
          correctOptionId: correct.id,
        };
      }),
    };
  });
}

export interface LockedExam {
  id: string;
  name: string;
}

/** Examen E2E réservé au parcours navigateur (sans session au démarrage). */
export async function getUiExam(): Promise<SeededExam> {
  return withE2eDb(async (prisma) => {
    const exam = await prisma.exam.findFirst({
      where: { name: E2E_UI_EXAM_NAME },
      select: { id: true, name: true },
    });
    if (!exam) {
      throw new Error(
        `[e2e] Examen UI "${E2E_UI_EXAM_NAME}" introuvable. Le globalSetup a-t-il tourné ?`,
      );
    }

    const questions = await prisma.question.findMany({
      where: { part: { examId: exam.id, type: "QCM" } },
      orderBy: { order: "asc" },
      select: {
        id: true,
        text: true,
        options: { select: { id: true, isCorrect: true } },
      },
    });

    return {
      id: exam.id,
      name: exam.name,
      questions: questions.map((question) => {
        const correct = question.options.find((option) => option.isCorrect);
        if (!correct) {
          throw new Error(
            `[e2e] Question ${question.id} sans option correcte dans le seed.`,
          );
        }
        return {
          id: question.id,
          text: question.text,
          correctOptionId: correct.id,
        };
      }),
    };
  });
}

/** Examen E2E programmé dans le futur : doit rester verrouillé pour le candidat. */
export async function getLockedExam(): Promise<LockedExam> {
  return withE2eDb(async (prisma) => {
    const exam = await prisma.exam.findFirst({
      where: { name: E2E_LOCKED_EXAM_NAME },
      select: { id: true, name: true },
    });
    if (!exam) {
      throw new Error(
        `[e2e] Examen verrouillé "${E2E_LOCKED_EXAM_NAME}" introuvable. Le globalSetup a-t-il tourné ?`,
      );
    }
    return exam;
  });
}

export interface IssuedCertification {
  id: string;
  code: string;
  status: string;
  sessionId: string | null;
}

/**
 * Dernière certification du candidat semé, telle qu'émise par l'application.
 * Renvoie `null` si le flux applicatif n'en a pas (encore) produit.
 */
export async function getIssuedCertification(): Promise<IssuedCertification | null> {
  return withE2eDb(async (prisma) => {
    const candidate = await prisma.user.findUnique({
      where: { email: CANDIDATE_EMAIL },
      select: { id: true },
    });
    if (!candidate) return null;

    return prisma.attestation.findFirst({
      where: { userId: candidate.id, type: "CERTIFICATION" },
      orderBy: { issuedAt: "desc" },
      select: { id: true, code: true, status: true, sessionId: true },
    });
  });
}
