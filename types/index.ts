/**
 * Shared Type Definitions for Attestations FSA
 * Used to replace 'any' types across the application.
 */

export type UserRole = "user" | "admin" | "superadmin";

export type UserStatus = "ACTIVE" | "BLOCKED" | "SUSPENDED";

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | string | null;
  image: string | null;
  role: string;
  status: UserStatus;
  phone: string | null;
  address: string | null;
  birthDate: Date | string | null;
  birthPlace: string | null;
  attestationCode: string | null;
  attestationStatus: string;
  formationId: string | null;
  examId?: string | null;
  examScheduledAt?: Date | string | null;
  exam?: {
    id: string;
    title: string;
    name: string;
    status: string;
    scheduledAt: Date | string | null;
  } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Formation {
  id: string;
  name: string;
  category: string;
  description: string | null;
  skills: string[];
  createdAt: Date | string;
}

export type AttestationType = "FORMATION" | "STAGE" | "CERTIFICATION";
export type AttestationStatus = "PENDING" | "VALIDATED" | "REJECTED" | "CLAIMED";

export interface Attestation {
  id: string;
  code: string;
  email: string | null;
  issuedAt: Date | string;
  type: AttestationType;
  fullName: string;
  birthDate: Date | string;
  birthPlace: string;
  formationId: string;
  startDate: Date | string;
  endDate: Date | string;
  location: string;
  instructor: string;
  issuingCompany: string;
  status: AttestationStatus;
  pdfUrl: string | null;
  gender: "M" | "F" | null;
  stageHours: number | null;
  stageScore: number | null;
  stageObservations: string | null;
  certificationHours: number | null;
  certificationMention: string | null;
  certificationScore: number | null;
  certificationObservations: string | null;
  userId: string | null;
  formation?: Formation;
  user?: User | null;
}

export type ExamStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";
export type ExamType = "OFFICIAL" | "MOCK";

export interface Exam {
  id: string;
  title: string;
  name: string;
  description: string | null;
  status: ExamStatus;
  type: ExamType;
  duration: number;
  totalPoints: number;
  passingScore: number;
  formationId: string | null;
  scheduledAt: Date | string | null;
  session: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ExamSession {
  id: string;
  examId: string;
  userId: string;
  status: string;
  score: number;
  internshipScore: number;
  finalScore: number;
  totalScore: number;
  startedAt: Date | string;
  submittedAt: Date | string | null;
  answers: Record<string, any>;
  type: ExamType;
  exam?: Exam;
  candidate?: User;
}

export enum NotificationType {
  ATTESTATION_VALIDATED = "ATTESTATION_VALIDATED",
  ATTESTATION_REJECTED = "ATTESTATION_REJECTED",
  EXAM_RESULT_PUBLISHED = "EXAM_RESULT_PUBLISHED",
  INTERNSHIP_ACCEPTED = "INTERNSHIP_ACCEPTED",
  INTERNSHIP_REJECTED = "INTERNSHIP_REJECTED",
  CORRECTION_APPROVED = "CORRECTION_APPROVED",
  CORRECTION_REJECTED = "CORRECTION_REJECTED",
  SUPPORT_REPLY = "SUPPORT_REPLY",
  GENERAL = "GENERAL"
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  metadata: any;
  createdAt: Date | string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue: any;
  newValue: any;
  ipAddress: string | null;
  timestamp: Date | string;
  user?: User;
}

export interface SecurityLog {
  id: string;
  eventType: string;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  timestamp: Date | string;
  details: any;
  user?: User;
}


