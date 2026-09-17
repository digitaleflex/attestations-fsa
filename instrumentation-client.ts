import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "./lib/observability/sentry-config";

// #151 — init navigateur (Next 16 : `instrumentation-client.ts` à la racine).
// Sans NEXT_PUBLIC_SENTRY_DSN, aucun init, donc no-op côté client.
const options = buildSentryOptions("client");

if (options) {
  Sentry.init(options);
}
