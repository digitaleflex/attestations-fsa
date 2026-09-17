import * as Sentry from "@sentry/nextjs";

import { buildSentryOptions } from "./lib/observability/sentry-config";

// #151 — observabilité optionnelle : sans SENTRY_DSN, aucun init, donc no-op.
const options = buildSentryOptions("server");

if (options) {
  Sentry.init(options);
}
