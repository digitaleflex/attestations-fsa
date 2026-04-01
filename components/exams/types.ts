export type Option = {
  text: string;
  isCorrect: boolean;
};

export type Question = {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'OPEN';
  points: number;
  options?: Option[];
};

export type Part = {
  title: string;
  type: 'QCM' | 'OPEN' | 'CASE_STUDY';
  duration: number;
  points: number;
  scenario?: string;
  questions: Question[];
};

export type ExamFormData = {
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
  scheduledAt: string;
  parts: Part[];
};

export const DEFAULT_PARTS: Part[] = [
  {
    title: "Partie 1 : QCM",
    type: "QCM",
    duration: 30,
    points: 20,
    questions: []
  },
  {
    title: "Partie 2 : Questions Ouvertes",
    type: "OPEN",
    duration: 60,
    points: 40,
    questions: []
  },
  {
    title: "Partie 3 : Étude de Cas",
    type: "CASE_STUDY",
    duration: 90,
    points: 40,
    scenario: "",
    questions: []
  }
];
