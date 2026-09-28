import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Vague 0 / item 1 — non-régression « aucun secret dans les logs ».
 *
 * `lib/email.ts` journalisait les codes OTP en clair, sans garde
 * `NODE_ENV` : en production, un OTP en clair dans les logs est un canal de
 * prise de contrôle de compte direct (les logs sont archivés, indexés, lus
 * par des tiers). Ce test échoue si un OTP (ou le token d'un lien magique)
 * réapparaît dans une sortie console.
 *
 * Deux niveaux de preuve :
 *  1. comportemental — on appelle réellement `emailService` (client Resend
 *     mocké, aucun envoi réseau) en `NODE_ENV=production` et on capture tout
 *     ce qui part sur console ;
 *  2. statique — on relit la source et on refuse tout `console.*` qui
 *     interpole un secret, sauf à l'intérieur d'un bloc explicitement gardé
 *     par `if (process.env.NODE_ENV !== "production")`.
 */

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => {
  class Resend {
    emails = { send: mocks.send };
    constructor(_apiKey?: string) {}
  }
  return { Resend };
});

import {
  emailService,
  __resetResendInstanceForTests,
} from "@/lib/email";

const ORIGINAL_ENV = { ...process.env };

const TO = "candidat@example.com";
const NAME = "Alice Candidat";
const OTP = "839201";
const MAGIC_LINK = "https://app.example.com/api/auth/verify?token=secret-abc123";

/** Capture réelle de tout ce que le code écrit sur la console. */
function captureConsole() {
  const lines: string[] = [];
  const record = (level: string) =>
    vi
      .spyOn(console, level as "log" | "warn" | "error" | "info" | "debug")
      .mockImplementation((...args: unknown[]) => {
        lines.push(args.map((a) => String(a)).join(" "));
      });
  const spies = (["log", "warn", "error", "info", "debug"] as const).map(
    record,
  );
  return {
    lines,
    get output() {
      return lines.join("\n");
    },
    restore: () => spies.forEach((s) => s.mockRestore()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Succès « envoyé » : c'est le seul chemin qui déclenche les logs « ✅ ».
  mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  __resetResendInstanceForTests();
  // Clé présente : sinon `requireResendApiKey()` lève en production et on
  // testerait le mauvais chemin (le `catch`).
  process.env.RESEND_API_KEY = "re_test_fake_key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Les 5 envois qui transportent un secret (OTP ou lien de connexion). */
const SECRET_EMAILS = [
  {
    label: "sendPasswordResetOTP (réinitialisation de mot de passe)",
    call: () => emailService.sendPasswordResetOTP(TO, NAME, OTP),
    secret: OTP,
    // `sendTwoFactorOTP` est le seul des cinq qui ne journalise rien en cas
    // de succès : rien à préserver, mais le test de non-régression s'applique
    // quand même.
    logsOnSuccess: true,
  },
  {
    label: "sendVerificationOTP (vérification d'adresse e-mail)",
    call: () => emailService.sendVerificationOTP(TO, NAME, OTP),
    secret: OTP,
    logsOnSuccess: true,
  },
  {
    label: "sendFsaLoginOTP (connexion par Code FSA)",
    call: () => emailService.sendFsaLoginOTP(TO, NAME, OTP),
    secret: OTP,
    logsOnSuccess: true,
  },
  {
    label: "sendTwoFactorOTP (2FA administrateur)",
    call: () => emailService.sendTwoFactorOTP(TO, NAME, OTP),
    secret: OTP,
    logsOnSuccess: false,
  },
  {
    label: "sendMagicLink (lien de connexion)",
    call: () => emailService.sendMagicLink(TO, NAME, MAGIC_LINK),
    secret: MAGIC_LINK,
    logsOnSuccess: true,
  },
];

describe("emailService — aucun secret dans les logs en production", () => {
  for (const { label, call, secret, logsOnSuccess } of SECRET_EMAILS) {
    it(`${label} : le code n'apparaît dans aucune sortie console`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      const cap = captureConsole();
      try {
        const res = await call();
        expect(res).toEqual({ success: true });
        expect(cap.output).not.toContain(secret);
        // Un lien magique ne doit pas non plus apparaître en clair.
        if (secret === MAGIC_LINK) {
          expect(cap.output).not.toContain("secret-abc123");
        }
      } finally {
        cap.restore();
      }
    });

    it(`${label} : ${logsOnSuccess ? "le log de succès est conservé (destinataire seul)" : "aucune sortie console n'est produite"}`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      const cap = captureConsole();
      try {
        await call();
        if (logsOnSuccess) {
          // On ne supprime pas la fonctionnalité de log : seul le secret part.
          expect(cap.output).toContain("[EMAIL_SERVICE]");
          expect(cap.output).toContain(TO);
        } else {
          expect(cap.output).toBe("");
        }
      } finally {
        cap.restore();
      }
    });
  }

  it("aucun masquage partiel réversible du code n'est utilisé", async () => {
    // Un masque style `839***` ou `otp.slice(0,2)` ne protège pas : on
    // vérifie qu'aucun fragment du code ne fuit non plus.
    vi.stubEnv("NODE_ENV", "production");
    const cap = captureConsole();
    try {
      await emailService.sendPasswordResetOTP(TO, NAME, OTP);
      for (let i = 0; i < OTP.length - 1; i++) {
        expect(cap.output).not.toContain(OTP.slice(i, i + 4));
      }
    } finally {
      cap.restore();
    }
  });
});

describe("emailService — le code reste observable hors production", () => {
  it("l'OTP est journalisé en développement (confort de dev assumé)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const cap = captureConsole();
    try {
      await emailService.sendPasswordResetOTP(TO, NAME, OTP);
      expect(cap.output).toContain(OTP);
    } finally {
      cap.restore();
    }
  });

  it("la garde est bien NODE_ENV, pas une suppression : NODE_ENV=test voit le code", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const cap = captureConsole();
    try {
      await emailService.sendVerificationOTP(TO, NAME, OTP);
      expect(cap.output).toContain(OTP);
    } finally {
      cap.restore();
    }
  });
});

describe("lib/email.ts — contrôle statique des console.*", () => {
  const FILE = path.resolve(__dirname, "../../lib/email.ts");
  const source = fs.readFileSync(FILE, "utf8");
  const lines = source.split("\n");

  /** Interpolation de template interdite dans une sortie console. */
  const FORBIDDEN = [
    "otp",
    "token",
    "magicLinkUrl",
    "resetLink",
    "apiKey",
    "password",
    "secret",
  ];

  const GUARD_OPEN =
    /if\s*\(\s*process\.env\.NODE_ENV\s*!==\s*["']production["']\s*\)\s*\{\s*$/;

  /**
   * Balaye le fichier et renvoie, pour chaque ligne, si elle se trouve dans
   * un bloc gardé `NODE_ENV !== "production"` (suivi de profondeur d'accolades).
   */
  function guardedLines(src: string[]): boolean[] {
    const out: boolean[] = [];
    let depth = 0;
    let guardedAt: number | null = null;
    for (const line of src) {
      if (guardedAt !== null && depth < guardedAt) guardedAt = null;
      out.push(guardedAt !== null);
      if (GUARD_OPEN.test(line.trim())) guardedAt = depth + 1;
      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
    }
    return out;
  }

  const isGuarded = guardedLines(lines);

  it("aucune interpolation de secret dans un console.* non gardé", () => {
    const offenders: string[] = [];
    lines.forEach((line, i) => {
      if (!/console\.(log|warn|error|info|debug)\s*\(/.test(line)) return;
      if (isGuarded[i]) return;
      for (const name of FORBIDDEN) {
        if (line.includes("${" + name)) {
          offenders.push(`L${i + 1}: ${line.trim()}`);
        }
      }
    });
    expect(
      offenders,
      `Secrets interpolés dans des logs non gardés par NODE_ENV :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("aucun secret n'est écrit par une interpolation implicite (${to} exclu)", () => {
    // Filet secondaire : un secret passé sous un autre nom d-variable
    // (`code`, `pin`…) ne doit pas non plus être journalisé en prod.
    const offenders: string[] = [];
    lines.forEach((line, i) => {
      if (!/console\.(log|warn|error|info|debug)\s*\(/.test(line)) return;
      if (isGuarded[i]) return;
      const vars = [...line.matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g)].map(
        (m) => m[1],
      );
      for (const v of vars) {
        if (["to", "year", "error", "fullName", "examTitle", "score", "v"].includes(v)) continue;
        offenders.push(`L${i + 1}: variable \`${v}\` journalisée`);
      }
    });
    expect(
      offenders,
      `Variables inattendues dans un log non gardé :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("la clé RESEND_API_KEY n'est jamais journalisée", () => {
    expect(source).not.toMatch(/console\.[a-z]+\([^)]*\$\{\s*apiKey\s*\}/);
  });
});
