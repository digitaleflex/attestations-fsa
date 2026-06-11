export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options?: QuestionOption[];
}

export interface ExamPart {
  id: string;
  order: number;
  type: string;
  scenario?: string;
  mode?: string;
  questions: Question[];
}

export interface ExamData {
  id: string;
  name: string;
  description: string;
  duration: number;
  part1Enabled: boolean;
  part2Enabled: boolean;
  part3Enabled: boolean;
  part1Points: number;
  part2Points: number;
  part3Points: number;
  part1Questions: number;
  part2Questions: number;
  part3Subject: string | null;
  passingScore: number;
  randomizeQuestions: boolean;
  showResults: boolean;
  status: string;
  totalPoints: number;
  parts: ExamPart[];
}
