// lib/email-verified.ts
// Utilitaire centralisé pour la conversion `emailVerified`.
// Contexte : Better Auth envoie `boolean`, Prisma attend `Date | null`.
// Toute la conversion doit passer par ici (zéro doublon).

/**
 * Convertit une valeur `emailVerified` hétérogène (boolean | Date | null | undefined)
 * en valeur compatible Prisma (`Date | null`).
 *
 * - `true` -> `new Date()` (vérifié maintenant)
 * - `Date` -> la date telle quelle
 * - `false | null | undefined | autre` -> `null` (non vérifié)
 */
export function toEmailVerifiedDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value === true) return new Date();
  return null;
}

/**
 * Vrai si l'email est considéré comme vérifié.
 * Utilisé pour exposer `emailVerified: boolean` dans les sessions.
 */
export function isEmailVerified(value: unknown): boolean {
  if (value instanceof Date) return true;
  return value === true;
}

/**
 * Normalise le champ `emailVerified` d'un objet user (copie pure).
 * Si le champ est absent, retourne l'objet inchangé (même référence).
 */
export function normalizeEmailVerified<T extends Record<string, unknown>>(
  data: T,
): T {
  if (!data || typeof data !== "object" || !("emailVerified" in data)) {
    return data;
  }
  return {
    ...data,
    emailVerified: toEmailVerifiedDate(
      (data as Record<string, unknown>).emailVerified,
    ),
  };
}
