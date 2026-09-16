/**
 * Configuration Sentry — cœur testable, SANS import de `@sentry/nextjs`.
 *
 * Contrainte projet (#151) : l'observabilité est 100 % optionnelle. Tant
 * qu'aucun DSN n'est fourni, l'application démarre normalement et aucune
 * remontée n'est émise. Toute la résolution des variables d'environnement
 * vit ici afin d'être testable sans charger le SDK (coûteux à importer).
 */

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

import {
  scrubSentryEvent,
  scrubSentryTransaction,
  type SentryTransactionEvent,
} from "./sentry-scrub";

export type SentryRuntime = "server" | "edge" | "client";

export interface SentryOptions {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate: number;
  /** Explicite, pour ne pas dépendre du défaut de version (#153). */
  sendDefaultPii: boolean;
  /** Scrubbing PII avant envoi des erreurs (#153). */
  beforeSend: (event: ErrorEvent, hint?: EventHint) => Promise<ErrorEvent>;
  /** Scrubbing PII avant envoi des transactions/traces (#153). */
  beforeSendTransaction: (
    event: SentryTransactionEvent,
    hint?: EventHint,
  ) => Promise<SentryTransactionEvent>;
}

function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * DSN effectif selon le runtime.
 * - server / edge : `SENTRY_DSN` (injectable au runtime), repli sur le DSN public.
 * - client : `NEXT_PUBLIC_SENTRY_DSN` uniquement (seule variable inlinée au build).
 */
export function resolveSentryDsn(
  runtime: SentryRuntime = "server",
): string | undefined {
  if (runtime === "client") {
    return readEnv(process.env.NEXT_PUBLIC_SENTRY_DSN);
  }

  return (
    readEnv(process.env.SENTRY_DSN) ??
    readEnv(process.env.NEXT_PUBLIC_SENTRY_DSN)
  );
}

/** Sentry est-il activé pour ce runtime ? (faux = no-op total) */
export function isSentryEnabled(runtime: SentryRuntime = "server"): boolean {
  return resolveSentryDsn(runtime) !== undefined;
}

/**
 * Taux d'échantillonnage des traces perf. Défaut `0` : on collecte les erreurs,
 * pas la performance, tant que ce n'est pas explicitement demandé.
 * Valeur invalide ou hors [0, 1] ramenée à `0` (jamais d'exception au démarrage).
 */
export function resolveSentryTracesSampleRate(): number {
  const raw = readEnv(process.env.SENTRY_TRACES_SAMPLE_RATE);
  if (!raw) return 0;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
}

export function resolveSentryEnvironment(): string | undefined {
  return readEnv(process.env.SENTRY_ENVIRONMENT) ?? readEnv(process.env.NODE_ENV);
}

export function resolveSentryRelease(): string | undefined {
  return readEnv(process.env.SENTRY_RELEASE);
}

/**
 * Options d'init Sentry, ou `null` si aucun DSN n'est configuré.
 * `null` signifie « ne pas appeler Sentry.init » → SDK inerte.
 */
export function buildSentryOptions(
  runtime: SentryRuntime = "server",
): SentryOptions | null {
  const dsn = resolveSentryDsn(runtime);
  if (!dsn) return null;

  return {
    dsn,
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease(),
    tracesSampleRate: resolveSentryTracesSampleRate(),
    // #153 — confidentialité : aucune donnée personnelle par défaut, et
    // scrubing systématique avant envoi (cf. lib/observability/sentry-scrub.ts).
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryTransaction,
  };
}
