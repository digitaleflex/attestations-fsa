import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Mock du SDK Resend : aucun envoi réseau ne doit jamais partir.
 * On capture la construction du client (clé passée) et l'appel `emails.send`.
 */
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  constructorKeys: [] as unknown[],
}));

vi.mock("resend", () => {
  class Resend {
    emails = { send: mocks.send };
    constructor(apiKey?: string) {
      mocks.constructorKeys.push(apiKey);
    }
  }
  return { Resend };
});

import {
  emailService,
  __resetResendInstanceForTests,
  resendDomain,
} from "@/lib/email";

const ORIGINAL_ENV = { ...process.env };

const TO = "candidat@example.com";
const NAME = "Alice Candidat";

/**
 * `fromEmail` est figé à l'import : on reconstruit la valeur attendue
 * avec la même règle (EMAIL_FROM prioritaire, sinon domaine Resend).
 */
const expectedFrom =
  process.env.EMAIL_FROM?.trim() || `Ferme St André <admin@${resendDomain}>`;

const OK = { data: { id: "email-1" }, error: null };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  mocks.constructorKeys.length = 0;
  // Le singleton Resend est mis en cache dans le module : on le réarme.
  __resetResendInstanceForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("emailService - construction du client Resend (getResend)", () => {
  it("construit un client dégradé si RESEND_API_KEY est absente hors production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.RESEND_API_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.send.mockResolvedValue(OK);

    const result = await emailService.sendInternshipConfirmation(TO, NAME);

    expect(result).toEqual({ success: true });
    expect(mocks.constructorKeys).toEqual(["disabled_key"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_API_KEY is missing"),
    );
  });

  it("traite une clé dégénérée (espaces) comme absente", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.RESEND_API_KEY = "   ";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.send.mockResolvedValue(OK);

    await emailService.sendInternshipConfirmation(TO, NAME);

    expect(mocks.constructorKeys).toEqual(["disabled_key"]);
  });

  it("construit le client avec la clé réelle quand elle est définie", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    mocks.send.mockResolvedValue(OK);

    await emailService.sendInternshipConfirmation(TO, NAME);

    expect(mocks.constructorKeys).toEqual(["re_test_123"]);
  });

  it("réutilise le même client Resend (singleton paresseux)", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    mocks.send.mockResolvedValue(OK);

    await emailService.sendInternshipConfirmation(TO, NAME);
    await emailService.sendInternshipConfirmation(TO, NAME);

    expect(mocks.constructorKeys).toEqual(["re_test_123"]);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("échoue vite (production) sans clé : renvoie success:false sans appeler le SDK", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.RESEND_API_KEY;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await emailService.sendInternshipConfirmation(TO, NAME);

    expect(result.success).toBe(false);
    expect((result as { error?: unknown }).error).toBeInstanceOf(Error);
    expect((result as { error: Error }).error.message).toContain(
      "RESEND_API_KEY must be set in production environment",
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled();
  });
});

describe("emailService - chemin nominal d'envoi", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_123";
    mocks.send.mockResolvedValue(OK);
  });

  it("sendExamResults (officiel, admis) transmet destinataire, sujet et contenu", async () => {
    const result = await emailService.sendExamResults(
      TO,
      NAME,
      "Filtre FSA",
      80,
      true,
      "OFFICIAL",
    );

    expect(result).toEqual({ success: true });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const payload = mocks.send.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
    };
    expect(payload.to).toBe(TO);
    expect(payload.from).toBe(expectedFrom);
    expect(payload.subject).toBe(
      "🎓 ADMIS ! Votre attestation est prête - Filtre FSA",
    );
    expect(payload.html).toContain(NAME);
    expect(payload.html).toContain("Filtre FSA");
    expect(payload.html).toContain("80");
    expect(payload.html).toContain("16.00 / 20");
  });

  it.each([
    [true, "MOCK", "🏆 Objectif Atteint : Filtre FSA", "OBJECTIF ATTEINT"],
    [false, "MOCK", "📝 Score Entraînement : Filtre FSA", "ENTRAÎNEMENT À POURSUIVRE"],
    [false, "OFFICIAL", "📉 Résultat Examen : REFUSÉ - Filtre FSA", "REFUSÉ"],
  ] as const)(
    "sendExamResults isSuccess=%s examType=%s couvre la branche de statut",
    async (isSuccess, examType, expectedSubject, statusSnippet) => {
      const result = await emailService.sendExamResults(
        TO,
        NAME,
        "Filtre FSA",
        55,
        isSuccess,
        examType,
      );

      expect(result).toEqual({ success: true });
      const payload = mocks.send.mock.calls[0][0] as { subject: string; html: string };
      expect(payload.subject).toBe(expectedSubject);
      expect(payload.html).toContain(statusSnippet);
    },
  );

  const nominalCases: Array<[string, () => Promise<{ success: boolean }>]> = [
    ["sendInternshipConfirmation", () => emailService.sendInternshipConfirmation(TO, NAME)],
    [
      "sendVerificationEmail",
      () => emailService.sendVerificationEmail(TO, NAME, "https://fsa.test/verify?t=1"),
    ],
    ["sendPasswordReset", () => emailService.sendPasswordReset(TO, NAME, "https://fsa.test/reset?t=1")],
    ["sendPasswordResetOTP", () => emailService.sendPasswordResetOTP(TO, NAME, "123456")],
    ["sendVerificationOTP", () => emailService.sendVerificationOTP(TO, NAME, "654321")],
    [
      "sendGeneralNotification",
      () => emailService.sendGeneralNotification(TO, NAME, "Maintenance", "Une coupure est prévue."),
    ],
    ["sendTwoFactorOTP", () => emailService.sendTwoFactorOTP(TO, NAME, "111222")],
    [
      "sendOfficialTranscriptNotification",
      () => emailService.sendOfficialTranscriptNotification(TO, NAME, "Filtre FSA", 70, true),
    ],
    ["sendFsaLoginOTP", () => emailService.sendFsaLoginOTP(TO, NAME, "999888")],
    ["sendMagicLink", () => emailService.sendMagicLink(TO, NAME, "https://fsa.test/magic?t=1")],
  ];

  it.each(nominalCases)("%s envoie via le SDK et renvoie success", async (_name, run) => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await run();

    expect(result).toEqual({ success: true });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const payload = mocks.send.mock.calls[0][0] as { to: string; from: string; html: string };
    expect(payload.to).toBe(TO);
    expect(payload.from).toBe(expectedFrom);
    expect(payload.html.length).toBeGreaterThan(0);
  });

  it("sendOfficialTranscriptNotification couvre la branche non-admis", async () => {
    const result = await emailService.sendOfficialTranscriptNotification(
      TO,
      NAME,
      "Filtre FSA",
      40,
      false,
    );

    expect(result).toEqual({ success: true });
    const payload = mocks.send.mock.calls[0][0] as { subject: string };
    expect(payload.subject).toBe("📝 Résultat de votre examen - Filtre FSA");
  });
});

describe("emailService - échec du SDK Resend (jamais d'exception qui remonte)", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_123";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("transforme une erreur retournée ({ data:null, error }) en success:false", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" },
    });

    const result = await emailService.sendPasswordResetOTP(TO, NAME, "123456");

    expect(result.success).toBe(false);
    const error = (result as { error: Error }).error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Resend send failed: domain not verified");
  });

  it("gère un rejet réseau du SDK (throw) sans propager l'exception", async () => {
    mocks.send.mockRejectedValue(new Error("network down"));

    const result = await emailService.sendMagicLink(TO, NAME, "https://fsa.test/magic");

    expect(result.success).toBe(false);
    expect((result as { error: Error }).error.message).toBe("network down");
  });

  it("sérialise une erreur sans message dans le message d'exception", async () => {
    mocks.send.mockResolvedValue({
      data: null,
      error: { statusCode: 400, name: "validation_error" },
    });

    const result = await emailService.sendGeneralNotification(TO, NAME, "T", "M");

    expect(result.success).toBe(false);
    const error = (result as { error: Error }).error;
    expect(error.message).toContain("Resend send failed:");
    expect(error.message).toContain("validation_error");
  });
});

describe("resendDomain", () => {
  it("est une chaîne non vide (domaine d'envoi résolu)", () => {
    expect(typeof resendDomain).toBe("string");
    expect(resendDomain.length).toBeGreaterThan(0);
  });
});
