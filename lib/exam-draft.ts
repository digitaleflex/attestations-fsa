import { getRedis, isRedisReady } from "@/lib/redis";

export interface ExamDraft {
  answers: Record<string, string>;
  timeRemaining: number;
  currentPart: number;
  lastSync: string;
}

const DRAFT_TTL = 86_400; // 24h

function draftKey(examId: string, userId: string): string {
  return `exam:draft:${examId}:${userId}`;
}

export async function saveDraft(
  examId: string,
  userId: string,
  draft: ExamDraft,
): Promise<boolean> {
  if (!isRedisReady()) return false;
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
    return draft;
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
