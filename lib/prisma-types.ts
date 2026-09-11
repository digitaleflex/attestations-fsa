// lib/prisma-types.ts
// ✅ Type-safe enums mirroring Prisma schema values
// These are TypeScript-only (no DB migration needed) to preserve data safety

// User roles
export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = typeof USER_ROLES[number];

// Exam session statuses
export const EXAM_SESSION_STATUSES = ['PENDING', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'GRADED'] as const;
export type ExamSessionStatus = typeof EXAM_SESSION_STATUSES[number];

// Attestation statuses
export const ATTESTATION_STATUSES = ['PENDING', 'CLAIMED', 'VALIDATED', 'REJECTED'] as const;
export type AttestationStatus = typeof ATTESTATION_STATUSES[number];

// Attestation types
export const ATTESTATION_TYPES = ['FORMATION', 'STAGE', 'CERTIFICATION'] as const;
export type AttestationType = typeof ATTESTATION_TYPES[number];

// Exam statuses
export const EXAM_STATUSES = ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] as const;
export type ExamStatus = typeof EXAM_STATUSES[number];

// Internship statuses
export const INTERNSHIP_STATUSES = ['PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED', 'ARCHIVED'] as const;
export type InternshipStatus = typeof INTERNSHIP_STATUSES[number];

// Correction statuses
export const CORRECTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type CorrectionStatus = typeof CORRECTION_STATUSES[number];

// Question types
export const QUESTION_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'OPEN'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

// Gender
export const GENDERS = ['M', 'F'] as const;
export type Gender = typeof GENDERS[number];

// Certification mentions
export const CERTIFICATION_MENTIONS = ['PASSABLE', 'ASSEZ_BIEN', 'BIEN', 'TRES_BIEN', 'EXCELLENCE'] as const;
export type CertificationMention = typeof CERTIFICATION_MENTIONS[number];

// ✅ Type guard helpers
export function isValidUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isValidExamSessionStatus(value: unknown): value is ExamSessionStatus {
  return EXAM_SESSION_STATUSES.includes(value as ExamSessionStatus);
}

export function isValidAttestationStatus(value: unknown): value is AttestationStatus {
  return ATTESTATION_STATUSES.includes(value as AttestationStatus);
}
