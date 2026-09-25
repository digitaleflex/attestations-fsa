import { getRedis, isRedisReady } from "@/lib/redis";

export interface ExamDraft {
  answers: Record<string, string>;
  timeRemaining: number;
  currentPart: number;
  lastSync: string;
}

const DRAFT_TTL = 86_400; // 24h
const MAX_DRAFT_BYTES = 256_000;
const MAX_DRAFT_ENTRIES = 1_000;
const MAX_DRAFT_TEXT_LENGTH = 20_000;

export function isValidExamDraft(value: unknown): value is ExamDraft {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const draft = value as Partial<ExamDraft>;
  if (
    typeof draft.timeRemaining !== 'number' ||
    !Number.isFinite(draft.timeRemaining) ||
    draft.timeRemaining < 0 ||
    typeof draft.currentPart !== 'number' ||
    !Number.isInteger(draft.currentPart) ||
    draft.currentPart < 1 ||
    draft.currentPart > 100 ||
    typeof draft.lastSync !== 'string' ||
    Number.isNaN(Date.parse(draft.lastSync)) ||
    draft.answers === null ||
    typeof draft.answers !== 'object' ||
    Array.isArray(draft.answers)
  ) {
    return false;
  }

  const entries = Object.entries(draft.answers);
  if (entries.length > MAX_DRAFT_ENTRIES) return false;
  if (
    entries.some(
      ([key, answer]) =>
        key.length === 0 ||
        key.length > 128 ||
        typeof answer !== 'string' ||
        answer.length > MAX_DRAFT_TEXT_LENGTH,
    )
  ) {
    return false;
  }
  try {
    return Buffer.byteLength(JSON.stringify(draft), 'utf8') <= MAX_DRAFT_BYTES;
  } catch {
    return false;
  }
}

function draftKey(examId: string, userId: string): string {
  return `exam:draft:${examId}:${userId}`;
}

export async function saveDraft(
  examId: string,
  userId: string,
  draft: ExamDraft,
): Promise<boolean> {
  if (!isValidExamDraft(draft) || !isRedisReady()) return false;
  try {
    const redis = getRedis()!;
    await redis.set(draftKey(examId, userId), draft, { ex: DRAFT_TTL });
    return true;
  } catch (error) {
    console.error("[DRAFT SAVE ERROR]", error);
    return false;
  }
}

export async function loadDraft(
  examId: string,
  userId: string,
): Promise<ExamDraft | null> {
  if (!isRedisReady()) return null;
  try {
    const redis = getRedis()!;
    const draft = await redis.get<ExamDraft>(draftKey(examId, userId));
    return isValidExamDraft(draft) ? draft : null;
  } catch (error) {
    console.error("[DRAFT LOAD ERROR]", error);
    return null;
  }
}

export async function deleteDraft(
  examId: string,
  userId: string,
): Promise<boolean> {
  if (!isRedisReady()) return false;
  try {
    const redis = getRedis()!;
    await redis.del(draftKey(examId, userId));
    return true;
  } catch (error) {
    console.error("[DRAFT DELETE ERROR]", error);
    return false;
  }
}
