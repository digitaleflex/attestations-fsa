/**
 * Seed E2E déterministe et idempotent (issue #139).
 *
 * Crée (ou recrée) l'examen OFFICIEL « QCM seul » utilisé par le parcours
 * candidat, relié à une formation dédiée, et remet à zéro l'état du candidat
 * semé pour que la suite soit rejouable à volonté.
 *
 * ⚠️ Ce script ne crée JAMAIS d'attestation : l'attestation doit être émise
 * par le flux applicatif (`POST /api/exams/[id]/submit` → `issueExamAttestation`)
 * sinon le test ne prouve rien. Il ne fait que supprimer les artefacts des
 * exécutions précédentes.
 */
import type { PrismaClient } from "@prisma/client";
import { CANDIDATE_EMAIL } from "./env";

export const E2E_FORMATION_NAME = "[E2E] Certification Pisciculture (#139)";
export const E2E_EXAM_NAME = "[E2E] Examen de certification Pisciculture (#139)";
export const E2E_UI_EXAM_NAME =
  "[E2E] Examen parcours navigateur — verrouillé par un bug UI (#139)";
export const E2E_LOCKED_EXAM_NAME =
  "[E2E] Examen verrouillé — programmé dans le futur (#139)";

interface SeedQuestion {
  text: string;
  options: { text: string; correct: boolean }[];
}

/** 5 questions QCM, une seule bonne réponse chacune. */
const QCM_QUESTIONS: SeedQuestion[] = [
  {
    text: "Quel est le principal avantage de la polyculture tilapia / pangasius ?",
    options: [
      { text: "Optimiser l'occupation de la colonne d'eau et les rendements", correct: true },
      { text: "Réduire la quantité d'oxygène dissous nécessaire", correct: false },
      { text: "Supprimer le besoin de renouvellement d'eau", correct: false },
    ],
  },
  {
    text: "À quoi sert le sexage manuel chez le tilapia en production d'alevins ?",
    options: [
      { text: "À séparer les mâles des femelles pour maîtriser la reproduction", correct: true },
      { text: "À accélérer la croissance des juvéniles", correct: false },
      { text: "À prévenir les maladies bactériennes", correct: false },
    ],
  },
  {
    text: "Quel indicateur suit-on en priorité pour piloter l'alimentation en grossissement ?",
    options: [
      { text: "Le poids moyen et le taux de conversion alimentaire", correct: true },
      { text: "La couleur de l'eau uniquement", correct: false },
      { text: "Le nombre de sauts des poissons", correct: false },
    ],
  },
  {
    text: "En pisciculture intensive, quel est le facteur limitant le plus fréquent ?",
    options: [
      { text: "La qualité de l'eau (oxygène dissous, ammoniaque)", correct: true },
      { text: "La superficie totale du site", correct: false },
      { text: "La distance au marché", correct: false },
    ],
  },
  {
    text: "Pourquoi fertiliser un étang en pisciculture associée (porcs / canards) ?",
    options: [
      { text: "Pour stimuler le plancton, base de la chaîne alimentaire", correct: true },
      { text: "Pour refroidir l'eau en saison sèche", correct: false },
      { text: "Pour augmenter la salinité de l'étang", correct: false },
    ],
  },
];

const QCM_POINTS = 20;
const QCM_DURATION_MINUTES = 30;

export interface E2eSeedSummary {
  examId: string;
  examName: string;
  questionCount: number;
  candidateId: string;
  candidateEmail: string;
  formationId: string;
  formationName: string;
  /** true si le harnais a dû réparer le compte `credential` manquant (cf. bug seed). */
  repairedCandidateCredential: boolean;
}

export async function seedE2eData(prisma: PrismaClient): Promise<E2eSeedSummary> {
  const candidate = await prisma.user.findUnique({
    where: { email: CANDIDATE_EMAIL },
    select: { id: true, email: true, password: true },
  });
  if (!candidate) {
    throw new Error(
      `[e2e] Candidat semé "${CANDIDATE_EMAIL}" introuvable dans la base E2E. ` +
        "Lancer `pnpm db:seed` sur la base E2E avant les tests.",
    );
  }

  const repairedCandidateCredential = await ensureCandidateCredentialAccount(
    prisma,
    candidate.id,
    candidate.password,
  );

  const formationData = {
    name: E2E_FORMATION_NAME,
    category: "Pisciculture",
    description: "Formation dédiée aux tests E2E (issue #139).",
    skills: ["Pisciculture", "Certification"],
  };
  const existingFormation = await prisma.formation.findFirst({
    where: { name: E2E_FORMATION_NAME },
    select: { id: true },
  });
  const formation = existingFormation
    ? await prisma.formation.update({
        where: { id: existingFormation.id },
        data: formationData,
        select: { id: true, name: true },
      })
    : await prisma.formation.create({
        data: formationData,
        select: { id: true, name: true },
      });

  await resetPreviousRun(prisma, candidate.id, formation.id);

  const exam = await prisma.exam.create({
    data: buildQcmExamData({
      name: E2E_EXAM_NAME,
      description:
        "Examen officiel de démonstration E2E : QCM seul, correction automatique.",
      formationId: formation.id,
    }),
    select: { id: true, name: true },
  });

  // Examen jumeau réservé au parcours navigateur : il doit rester SANS session
  // car le test UI qui le consomme reproduit un bug bloquant (voir
  // `e2e/ui-examen.e2e.ts`) et peut laisser une session inachevée.
  await prisma.exam.create({
    data: buildQcmExamData({
      name: E2E_UI_EXAM_NAME,
      description:
        "Examen E2E réservé au parcours navigateur (défaut d'interface connu).",
      formationId: formation.id,
    }),
    select: { id: true },
  });

  // Examen programmé DANS LE FUTUR : doit rester verrouillé
  // (commit ca09715 — `isExamAvailable` exige scheduledAt atteint).
  await prisma.exam.create({
    data: {
      title: E2E_LOCKED_EXAM_NAME,
      name: E2E_LOCKED_EXAM_NAME,
      description:
        "Examen E2E volontairement programmé dans le futur : il doit rester verrouillé.",
      type: "OFFICIAL",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      duration: 3600,
      passingScore: 65,
      totalPoints: QCM_POINTS,
      showResults: true,
      part1Enabled: true,
      part1Points: QCM_POINTS,
      part1Questions: 0,
      part2Enabled: false,
      part2Points: 0,
      part3Enabled: false,
      part3Points: 0,
      formationId: formation.id,
    },
    select: { id: true },
  });

  return {
    examId: exam.id,
    examName: exam.name,
    questionCount: QCM_QUESTIONS.length,
    candidateId: candidate.id,
    candidateEmail: candidate.email ?? CANDIDATE_EMAIL,
    formationId: formation.id,
    formationName: formation.name,
    repairedCandidateCredential,
  };
}

/**
 * Définition d'un examen OFFICIEL « QCM seul », programmé dans le passé :
 * `autoOpenDueExams()` doit l'ouvrir paresseusement, puis la correction est
 * entièrement automatique (`finalStatus = COMPLETED`) — condition nécessaire
 * pour que `issueExamAttestation` émette une certification.
 */
function buildQcmExamData(params: {
  name: string;
  description: string;
  formationId: string;
}) {
  return {
    title: params.name,
    name: params.name,
    description: params.description,
    type: "OFFICIAL" as const,
    status: "SCHEDULED" as const,
    scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
    duration: 3600,
    passingScore: 65,
    totalPoints: QCM_POINTS,
    randomizeQuestions: false,
    showResults: true,
    part1Enabled: true,
    part1Points: QCM_POINTS,
    part1Questions: QCM_QUESTIONS.length,
    part2Enabled: false,
    part2Points: 0,
    part2Questions: 0,
    part3Enabled: false,
    part3Points: 0,
    formationId: params.formationId,
    parts: {
      create: [
        {
          title: "Partie 1 — QCM",
          type: "QCM",
          duration: QCM_DURATION_MINUTES,
          points: QCM_POINTS,
          order: 1,
          questions: {
            create: QCM_QUESTIONS.map((question, questionIndex) => ({
              text: question.text,
              type: "SINGLE_CHOICE" as const,
              points: QCM_POINTS / QCM_QUESTIONS.length,
              order: questionIndex + 1,
              options: {
                create: question.options.map((option) => ({
                  text: option.text,
                  isCorrect: option.correct,
                })),
              },
            })),
          },
        },
      ],
    },
  };
}

/**
 * Répare un défaut du seed applicatif.
 *
 * `prisma/seed.ts` crée un `Account` providerId "credential" UNIQUEMENT pour
 * l'admin (lignes 29-38) et avec `accountId = <email>` — or better-auth 1.7
 * exige `accountId === user.id` (cf. node_modules/better-auth/dist/api/routes/
 * sign-in.mjs:316 : `account.providerId === "credential" && account.accountId
 * === userRecord.user.id`). Le candidat semé (lignes 53-67) n'a, lui, aucun
 * `Account` du tout. Résultat : `signIn.email` répond « Email ou mot de passe
 * incorrect » pour les deux comptes semés.
 *
 * Le harnais complète donc la donnée de test manquante/désalignée ; le flux de
 * connexion lui-même reste intégralement celui de Better Auth. Le hash réutilisé
 * est celui déjà présent sur `User.password` (produit par `hashPassword` du seed),
 * ce qui évite d'importer toute la lib better-auth dans le process de test.
 * Renvoie `true` si une réparation a été nécessaire (signalé bruyamment).
 */
async function ensureCandidateCredentialAccount(
  prisma: PrismaClient,
  userId: string,
  userPasswordHash: string | null,
): Promise<boolean> {
  if (!userPasswordHash) {
    throw new Error(
      "[e2e] Le candidat semé n'a pas de hash de mot de passe sur User.password : " +
        "impossible de réparer le compte credential.",
    );
  }

  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true, password: true, accountId: true },
  });

  const alreadyValid =
    existing?.accountId === userId && Boolean(existing.password);
  if (alreadyValid) return false;

  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: {
        accountId: userId,
        password: userPasswordHash,
      },
    });
    return true;
  }

  await prisma.account.create({
    data: {
      userId,
      providerId: "credential",
      // better-auth 1.7 : l'accountId d'un compte credential est l'id user.
      accountId: userId,
      password: userPasswordHash,
    },
  });
  return true;
}

/**
 * Supprime les artefacts des exécutions précédentes :
 * sessions d'examen, réclamations/corrections liées, attestations de
 * certification du candidat pour cette formation, puis l'ancien examen.
 * Aucune attestation n'est insérée ici.
 */
async function resetPreviousRun(
  prisma: PrismaClient,
  candidateId: string,
  formationId: string,
): Promise<void> {
  const previousExams = await prisma.exam.findMany({
    where: { name: { in: [E2E_EXAM_NAME, E2E_UI_EXAM_NAME, E2E_LOCKED_EXAM_NAME] } },
    select: { id: true },
  });
  const previousExamIds = previousExams.map((exam) => exam.id);

  const previousSessions = await prisma.examSession.findMany({
    where: {
      OR: [
        ...(previousExamIds.length > 0
          ? [{ examId: { in: previousExamIds } }]
          : []),
        { userId: candidateId },
      ],
    },
    select: { id: true },
  });
  const sessionIds = previousSessions.map((session) => session.id);

  const previousAttestations = await prisma.attestation.findMany({
    where: {
      userId: candidateId,
      formationId,
      type: "CERTIFICATION",
    },
    select: { id: true },
  });
  const attestationIds = previousAttestations.map((attestation) => attestation.id);

  await prisma.$transaction([
    ...(sessionIds.length > 0
      ? [
          prisma.reclamation.deleteMany({ where: { submissionId: { in: sessionIds } } }),
          prisma.examSession.deleteMany({ where: { id: { in: sessionIds } } }),
        ]
      : []),
    ...(attestationIds.length > 0
      ? [
          prisma.correctionRequest.deleteMany({
            where: { attestationId: { in: attestationIds } },
          }),
          prisma.attestation.deleteMany({ where: { id: { in: attestationIds } } }),
        ]
      : []),
    ...(previousExamIds.length > 0
      ? [prisma.exam.deleteMany({ where: { id: { in: previousExamIds } } })]
      : []),
  ]);
}
