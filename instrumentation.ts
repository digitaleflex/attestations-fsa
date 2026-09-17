import * as Sentry from "@sentry/nextjs";

/**
 * Hook d'instrumentation Next.js (App Router) — convention requise par
 * `@sentry/nextjs` v10 : l'init serveur/edge doit se faire depuis `register()`.
 *
 * Sans DSN, chaque init est un no-op (cf. lib/observability/sentry-config.ts) :
 * l'application démarre normalement et ne remonte rien.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Erreurs serveur non gérées (route handlers, RSC imbriqués…). */
export const onRequestError = Sentry.captureRequestError;
