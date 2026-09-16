import { isSentryEnabled } from "./sentry-config";

/**
 * Remonte une erreur serveur à Sentry (#151).
 *
 * No-op strict sans `SENTRY_DSN` : on sort AVANT l'import dynamique du SDK,
 * donc aucun coût, aucun effet de bord et aucune dépendance au chargement en
 * l'absence de configuration. L'import est dynamique pour ne pas alourdir le
 * graphe de modules des tests ni le chemin nominal.
 *
 * L'observabilité ne doit jamais faire échouer la requête métier : toute
 * erreur du SDK est avalée silencieusement.
 */
export function captureServerError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isSentryEnabled()) return;

  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    })
    .catch(() => {
      // Une panne d'observabilité n'est jamais une panne applicative.
    });
}
