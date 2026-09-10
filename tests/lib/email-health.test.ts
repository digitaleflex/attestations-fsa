import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getResendApiKey,
  isEmailConfigured,
  requireResendApiKey,
  getEmailHealth,
} from "@/lib/email-health";

const ORIGINAL_ENV = { ...process.env };

describe("email-health - RESEND_API_KEY obligatoire en production", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("retourne la clé nettoyée quand elle est définie", () => {
    process.env.RESEND_API_KEY = "  re_test123  ";
    expect(getResendApiKey()).toBe("re_test123");
    expect(isEmailConfigured()).toBe(true);
  });

  it("retourne undefined quand la clé est absente ou vide", () => {
    delete process.env.RESEND_API_KEY;
    expect(getResendApiKey()).toBeUndefined();
    expect(isEmailConfigured()).toBe(false);

    process.env.RESEND_API_KEY = "   ";
    expect(getResendApiKey()).toBeUndefined();
    expect(isEmailConfigured()).toBe(false);
  });

  it("lève une erreur en production si la clé manque (fail-fast)", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.RESEND_API_KEY;
    expect(() => requireResendApiKey()).toThrow(
      "RESEND_API_KEY must be set in production environment",
    );
  });

  it("ne lève pas hors production si la clé manque (tolérant pour build/dev)", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.RESEND_API_KEY;
    expect(() => requireResendApiKey()).not.toThrow();
    expect(requireResendApiKey()).toBe("");
  });

  it("retourne la clé quand elle est présente, même en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.RESEND_API_KEY = "re_live123";
    expect(requireResendApiKey()).toBe("re_live123");
  });

  it("getEmailHealth reflète l'état de configuration", () => {
    process.env.RESEND_API_KEY = "re_abc";
    const healthy = getEmailHealth();
    expect(healthy.configured).toBe(true);
    expect(healthy.hasKey).toBe(true);
    expect(healthy.provider).toBe("resend");

    delete process.env.RESEND_API_KEY;
    const unhealthy = getEmailHealth();
    expect(unhealthy.configured).toBe(false);
    expect(unhealthy.hasKey).toBe(false);
  });
});
