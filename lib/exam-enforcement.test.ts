jest.mock("@/lib/prisma", () => ({
  prisma: {
    securityLog: {
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

import { evaluateEnforcement, logEnforcement } from "./exam-enforcement";
import { prisma } from "@/lib/prisma";

const mockFindMany = prisma.securityLog.findMany as jest.Mock;

describe("evaluateEnforcement", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("renvoie aucune action si aucun événement", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await evaluateEnforcement("exam-1", "user-1");
    expect(result).toEqual({ lockAnswers: false, forceSubmit: false, warnUser: false });
  });

  it("renvoie warnUser à 3 événements suspects", async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        action: i % 2 === 0 ? "VISIBILITY_CHANGE" : "BLUR",
        timestamp: new Date(),
      }))
    );
    const result = await evaluateEnforcement("exam-1", "user-1");
    expect(result.warnUser).toBe(true);
    expect(result.lockAnswers).toBe(false);
    expect(result.forceSubmit).toBe(false);
  });

  it("renvoie lockAnswers + warnUser à 5 événements", async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 5 }, () => ({
        action: "VISIBILITY_CHANGE",
        timestamp: new Date(),
      }))
    );
    const result = await evaluateEnforcement("exam-1", "user-1");
    expect(result.lockAnswers).toBe(true);
    expect(result.warnUser).toBe(true);
    expect(result.forceSubmit).toBe(false);
  });

  it("renvoie lockAnswers + forceSubmit à 10 événements", async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        action: "VISIBILITY_CHANGE",
        timestamp: new Date(),
      }))
    );
    const result = await evaluateEnforcement("exam-1", "user-1");
    expect(result.lockAnswers).toBe(true);
    expect(result.forceSubmit).toBe(true);
  });

  it("filtre les événements dans la dernière heure", async () => {
    const oldEvent = { action: "BLUR", timestamp: new Date(Date.now() - 7200_000) };
    mockFindMany.mockResolvedValue([oldEvent]);
    const result = await evaluateEnforcement("exam-1", "user-1");
    expect(result).toEqual({ lockAnswers: false, forceSubmit: false, warnUser: false });
  });

  it("ne compte que VISIBILITY_CHANGE et BLUR", async () => {
    mockFindMany.mockResolvedValue([
      { action: "FOCUS", timestamp: new Date() },
      { action: "WINDOW_RESIZE", timestamp: new Date() },
    ]);
    const result = await evaluateEnforcement("exam-1", "user-1");
    expect(result).toEqual({ lockAnswers: false, forceSubmit: false, warnUser: false });
  });
});

describe("logEnforcement", () => {
  it("crée une entrée SecurityLog avec forceSubmit", async () => {
    await logEnforcement("exam-1", "user-1", {
      lockAnswers: true,
      forceSubmit: true,
      warnUser: true,
      reason: "Test",
    }, "127.0.0.1", "jest");
    expect(prisma.securityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "ENFORCEMENT_ACTION",
          action: "FORCE_SUBMIT",
          status: "ENFORCED",
          severity: "CRITICAL",
        }),
      })
    );
  });

  it("crée une entrée SecurityLog avec lockAnswers", async () => {
    await logEnforcement("exam-1", "user-1", {
      lockAnswers: true,
      forceSubmit: false,
      warnUser: true,
      reason: "Test",
    }, "127.0.0.1", "jest");
    expect(prisma.securityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "LOCK_ANSWERS",
          severity: "HIGH",
        }),
      })
    );
  });

  it("crée une entrée SecurityLog avec WARNING", async () => {
    await logEnforcement("exam-1", "user-1", {
      lockAnswers: false,
      forceSubmit: false,
      warnUser: true,
      reason: "Avertissement",
    }, "127.0.0.1", "jest");
    expect(prisma.securityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "WARNING",
          severity: "MEDIUM",
          status: "ENFORCED",
        }),
      })
    );
  });
});
