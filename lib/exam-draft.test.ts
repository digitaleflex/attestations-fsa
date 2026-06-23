jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
  isRedisReady: jest.fn(),
}));

import { saveDraft, loadDraft, deleteDraft } from "./exam-draft";
import { getRedis, isRedisReady } from "@/lib/redis";

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockGetRedis = getRedis as jest.Mock;
const mockIsReady = isRedisReady as jest.Mock;
const mockDraft = { answers: { q1: "A" }, timeRemaining: 3000, currentPart: 1, lastSync: new Date().toISOString() };

describe("saveDraft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedis.mockReturnValue(mockRedis);
  });

  it("ne sauvegarde pas si Redis n'est pas prêt", async () => {
    mockIsReady.mockReturnValue(false);
    const result = await saveDraft("exam-1", "user-1", mockDraft);
    expect(result).toBe(false);
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it("sauvegarde avec TTL de 24h", async () => {
    mockIsReady.mockReturnValue(true);
    mockRedis.set.mockResolvedValue("OK");
    const result = await saveDraft("exam-1", "user-1", mockDraft);
    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "exam:draft:exam-1:user-1",
      mockDraft,
      { ex: 86_400 }
    );
  });

  it("retourne false en cas d'erreur", async () => {
    mockIsReady.mockReturnValue(true);
    mockRedis.set.mockRejectedValue(new Error("Redis down"));
    const result = await saveDraft("exam-1", "user-1", mockDraft);
    expect(result).toBe(false);
  });
});

describe("loadDraft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedis.mockReturnValue(mockRedis);
  });

  it("retourne null si Redis pas prêt", async () => {
    mockIsReady.mockReturnValue(false);
    const result = await loadDraft("exam-1", "user-1");
    expect(result).toBeNull();
  });

  it("retourne le brouillon existant", async () => {
    mockIsReady.mockReturnValue(true);
    mockRedis.get.mockResolvedValue(mockDraft);
    const result = await loadDraft("exam-1", "user-1");
    expect(result).toEqual(mockDraft);
  });

  it("retourne null si pas de brouillon", async () => {
    mockIsReady.mockReturnValue(true);
    mockRedis.get.mockResolvedValue(null);
    const result = await loadDraft("exam-1", "user-1");
    expect(result).toBeNull();
  });
});

describe("deleteDraft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedis.mockReturnValue(mockRedis);
  });

  it("ne supprime pas si Redis pas prêt", async () => {
    mockIsReady.mockReturnValue(false);
    const result = await deleteDraft("exam-1", "user-1");
    expect(result).toBe(false);
  });

  it("supprime le brouillon", async () => {
    mockIsReady.mockReturnValue(true);
    mockRedis.del.mockResolvedValue(1);
    const result = await deleteDraft("exam-1", "user-1");
    expect(result).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith("exam:draft:exam-1:user-1");
  });
});
