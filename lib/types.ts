// lib/types.ts
// Types globaux pour l'application - Élimine les `any`

import type {
  User,
  Attestation,
  Exam,
  ExamSession,
  ExamPart,
  Question,
  Formation,
  Notification,
  InternshipRequest,
  CorrectionRequest,
  ChatMessage,
  Contact,
  Resource,
  AuditLog,
  SecurityLog,
} from "@prisma/client";

// =================================================================
// TYPES POUR LES RÉPONSES API
// =================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =================================================================
// TYPES POUR AUTHENTIFICATION
// =================================================================

export interface SessionUser {
  id: string;
  email: string | null;
  name?: string | null;
  role: "ADMIN" | "USER" | string;
  emailVerified?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  image?: string | null;
}

// =================================================================
// TYPES POUR LES EXAMENS
// =================================================================

export interface ExamWithRelations extends Exam {
  formation?: Formation | null;
  parts?: ExamPartWithQuestions[];
  sessions?: ExamSession[];
}

export interface ExamPartWithQuestions extends ExamPart {
  questions?: QuestionWithOptions[];
}

export interface QuestionWithOptions extends Question {
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback?: string | null;
}

export interface ExamSessionWithRelations extends ExamSession {
  exam?: ExamWithRelations;
  candidate?: User;
}

export interface ExamSubmission {
  examId: string;
  answers: Record<string, string | string[]>;
  submittedAt?: Date;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  examType: "OFFICIAL" | "MOCK";
  score: number;
  totalScore: number;
  status: string;
  submittedAt: Date | null;
  scoredAt: Date | null;
}

// =================================================================
// TYPES POUR LES ATTESTATIONS
// =================================================================

export interface AttestationWithRelations extends Attestation {
  formation?: Formation;
  user?: User;
}

export interface AttestationFormData {
  fullName: string;
  gender?: "M" | "F";
  birthDate: string;
  birthPlace: string;
  formation: string;
  startDate: string;
  endDate: string;
  location: string;
  instructor: string;
  issuingCompany: string;
  type: "FORMATION" | "STAGE" | "CERTIFICATION";
  stageHours?: number;
  stageScore?: number;
  stageObservations?: string;
  certificationMention?: string;
  certificationScore?: number;
  certificationHours?: number;
  certificationObservations?: string;
}

export interface AttestationCode {
  code: string;
  isValid: boolean;
  attestation?: {
    fullName: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
    location: string;
    instructor: string;
    formation: {
      name: string;
      category: string;
    };
  };
}

// =================================================================
// TYPES POUR LES FORMATIONS
// =================================================================

export interface FormationWithRelations extends Formation {
  exams?: Exam[];
  attestations?: Attestation[];
  users?: User[];
}

// =================================================================
// TYPES POUR LES NOTIFICATIONS
// =================================================================

export interface NotificationWithUser extends Notification {
  user?: User;
}

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// =================================================================
// TYPES POUR LES STAGES
// =================================================================

export interface InternshipWithUser extends InternshipRequest {
  user?: User;
}

export interface InternshipFormData {
  fullName: string;
  email: string;
  phone: string;
  university?: string;
  level?: string;
  position: string;
  cvUrl?: string;
  message?: string;
}

// =================================================================
// TYPES POUR LE PROFIL UTILISATEUR
// =================================================================

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  birthDate?: Date | null;
  birthPlace?: string | null;
  address?: string | null;
  gender?: "M" | "F" | null;
  formationId?: string | null;
  formation?: Formation | null;
  role: string;
  status: string;
  attestationCode?: string | null;
  attestationStatus?: string;
  enrolledAt?: Date | null;
  createdAt: Date;
}

// =================================================================
// TYPES POUR LE TABLEAU DE BORD ADMIN
// =================================================================

export interface DashboardStats {
  totalUsers: number;
  totalAttestations: number;
  totalExams: number;
  examsPassed: number;
  examsFailed: number;
  passRate: number;
  newThisMonth: number;
  admins: number;
  candidates: number;
}

export interface AttestationStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  thisMonth: number;
  lastMonth: number;
}

export interface ExamStats {
  total: number;
  published: number;
  scheduled: number;
  draft: number;
  averageScore: number;
}

// =================================================================
// TYPES POUR LES RESSOURCES
// =================================================================

export interface ResourceWithCategory {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string;
  thumbnail: string | null;
  category: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =================================================================
// TYPES POUR LE TRANSCRIPT
// =================================================================

export interface TranscriptData {
  userId: string;
  userName: string;
  examResults: ExamResult[];
  attestations: AttestationWithRelations[];
  totalCredits: number;
  gpa: number;
}

// =================================================================
// TYPES POUR LES CORRECTIONS
// =================================================================

export interface CorrectionWithAttestation extends CorrectionRequest {
  attestation?: Attestation;
  user?: User;
}

// =================================================================
// TYPES POUR LE CHAT
// =================================================================

export interface ChatMessageWithUser extends ChatMessage {
  user?: User;
}

// =================================================================
// TYPES POUR LE CONTACT/SUPPORT
// =================================================================

export interface ContactWithDetails extends Contact {
  user?: User;
}

// =================================================================
// TYPES POUR L'AUDIT
// =================================================================

export interface AuditLogWithUser extends AuditLog {
  user?: User;
}

export interface SecurityLogEntry extends SecurityLog {
  user?: User;
}

// =================================================================
// TYPES POUR LES ERREURS
// =================================================================

export interface AppError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export interface ValidationError {
  field: string;
  message: string;
}

// =================================================================
// TYPES POUR LES FILTRES DE RECHERCHE
// =================================================================

export interface SearchFilters {
  search?: string;
  status?: string;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
  formationId?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

// =================================================================
// TYPES POUR LES DONNÉES STATISTIQUES
// =================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

export interface DistributionData {
  type: string;
  count: number;
  percentage: number;
}

// =================================================================
// TYPES POUR LES ÉVÉNEMENTS TEMPS RÉEL
// =================================================================

export interface RealtimeEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ChatEvent {
  id: string;
  content: string;
  senderId: string;
  senderRole: string;
  userId: string;
  createdAt: Date;
}
