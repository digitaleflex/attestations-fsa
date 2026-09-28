// lib/stage-attestation/index.ts
// Point d'entrée du module d'attestation de stage (#265 / #266).

export {
  STAGE_LIMITS,
  FORBIDDEN_IDENTITY_FIELDS,
  stageAttestationInputSchema,
  validateStageAttestationInput,
  type StageAttestationInput,
  type ValidationResult,
} from "./validation";

export {
  issueStageAttestation,
  clearStageAttestationInFlightForTests,
  StageAttestationError,
  type IssueStageAttestationArgs,
  type StageAttestationOutcome,
  type StageAttestationErrorCode,
} from "./issue";
