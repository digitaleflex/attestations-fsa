// lib/email-health.ts
// Santé et garde-fous pour l'envoi d'emails (Resend).
// Objectif : échouer vite (fail-fast) si RESEND_API_KEY manque en production,
// tout en restant tolérant pendant le build / développement local.

export const EMAIL_PROVIDER = "resend" as const;

export type EmailHealth = {
  configured: boolean;
  provider: typeof EMAIL_PROVIDER;
  hasKey: boolean;
  env: string | undefined;
  fromConfigured: boolean;
};

/**
 * Retourne la clé Resend nettoyée, ou undefined si absente/vide.
 */
export function getResendApiKey(): string | undefined {
  const raw = process.env.RESEND_API_KEY;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Vrai si l'envoi d'emails est configuré (clé présente).
 */
export function isEmailConfigured(): boolean {
  return getResendApiKey() !== undefined;
}

/**
 * Exige la clé Resend.
 * - En production : lève une erreur si absente (fail-fast).
 * - Hors production : retourne "" et laisse l'appelant utiliser un fallback
 *   (ex. instance "disabled_key" pour ne pas casser le build).
 *
 * @throws si NODE_ENV === "production" et clé manquante.
 */
export function requireResendApiKey(): string {
  const key = getResendApiKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY must be set in production environment");
    }
    return "";
  }
  return key;
}

/**
 * Snapshot de santé email, utile pour les endpoints /api/health
 * et pour le logging au démarrage.
 */
export function getEmailHealth(): EmailHealth {
  const hasKey = isEmailConfigured();
  return {
    configured: hasKey,
    provider: EMAIL_PROVIDER,
    hasKey,
    env: process.env.NODE_ENV,
    fromConfigured: true,
  };
}
