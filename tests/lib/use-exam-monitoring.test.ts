import { describe, it, expect } from "vitest";
import { shouldTriggerViolation } from "@/lib/useExamMonitoring";

describe("shouldTriggerViolation", () => {
  it("ne déclenche pas sous le seuil", () => {
    expect(shouldTriggerViolation(0, 3)).toBe(false);
    expect(shouldTriggerViolation(2, 3)).toBe(false);
  });

  it("déclenche au seuil exact", () => {
    expect(shouldTriggerViolation(3, 3)).toBe(true);
  });

  it("déclenche au-delà du seuil", () => {
    expect(shouldTriggerViolation(4, 3)).toBe(true);
    expect(shouldTriggerViolation(10, 3)).toBe(true);
  });

  it("gère un seuil personnalisé", () => {
    expect(shouldTriggerViolation(5, 5)).toBe(true);
    expect(shouldTriggerViolation(4, 5)).toBe(false);
  });

  it("gère un seuil à 0 (toute perte de focus est une violation)", () => {
    expect(shouldTriggerViolation(0, 0)).toBe(true);
    expect(shouldTriggerViolation(1, 0)).toBe(true);
  });
});
