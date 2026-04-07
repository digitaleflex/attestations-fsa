// Types for Exam form components

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
  feedback?: string;
}

// Alias for compatibility
export type Option = QuestionOption;

export interface Question {
  text: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "OPEN";
  points: number;
  order: number;
  options?: QuestionOption[];
}

export interface Part {
  id?: string;
  title: string;
  type: "QCM" | "OPEN" | "CASE_STUDY";
  duration: number;
  points: number;
  order: number;
  enabled: boolean;
  subject?: string;
  scenario?: string;
  mode?: "digital" | "physical";
  questions: Question[];
}

export interface ExamFormData {
  id?: string;
  name?: string;
  title: string;
  session?: string;
  description?: string;
  formationId?: string;
  duration?: number;
  passingScore?: number;
  totalPoints?: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";
  scheduledAt: string;
  type?: "OFFICIAL" | "MOCK";
  part1Enabled?: boolean;
  part2Enabled?: boolean;
  part3Enabled?: boolean;
  parts: Part[];
  randomizeQuestions?: boolean;
  showResults?: boolean;
}

export const DEFAULT_PARTS: Part[] = [
  {
    id: "1",
    title: "Partie 1 : QCM",
    type: "QCM",
    duration: 30,
    points: 20,
    order: 1,
    enabled: true,
    questions: [],
  },
  {
    id: "2",
    title: "Partie 2 : Questions Ouvertes",
    type: "OPEN",
    duration: 30,
    points: 40,
    order: 2,
    enabled: true,
    questions: [],
  },
  {
    id: "3",
    title: "Partie 3 : Étude de Cas",
    type: "CASE_STUDY",
    duration: 30,
    points: 40,
    order: 3,
    enabled: true,
    questions: [],
    scenario: "",
    mode: "digital",
  },
];
