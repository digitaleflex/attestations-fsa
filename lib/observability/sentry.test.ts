import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

import { captureServerError } from "./sentry-capture";
import {
  buildSentryOptions,
  isSentryEnabled,
  resolveSentryDsn,
  resolveSentryTracesSampleRate,
} from "./sentry-config";

const SENTRY_ENV_KEYS = [
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "SENTRY_RELEASE",
  "SENTRY_TRACES_SAMPLE_RATE",
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  savedEnv.clear();
  for (const key of SENTRY_ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Sentry optionnel — sans DSN (#151)", () => {
  it("aucun DSN => Sentry désactivé pour tous les runtimes", () => {
    expect(resolveSentryDsn()).toBeUndefined();
    expect(resolveSentryDsn("client")).toBeUndefined();
    expect(isSentryEnabled()).toBe(false);
    expect(buildSentryOptions("server")).toBeNull();
    expect(buildSentryOptions("edge")).toBeNull();
    expect(buildSentryOptions("client")).toBeNull();
  });

  it("captureServerError est un no-op (SDK jamais appelé)", async () => {
    captureServerError(new Error("boom"), { route: "/api/x" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("les fichiers d'init ne chargent pas le SDK sans DSN", async () => {
    await import("../../sentry.server.config");
    await import("../../sentry.edge.config");
    await import("../../instrumentation-client");

    expect(Sentry.init).not.toHaveBeenCalled();
  });
});

describe("Sentry optionnel — avec SENTRY_DSN (#151)", () => {
  it("construit les options serveur depuis l'environnement", () => {
    process.env.SENTRY_DSN = "https://key@example.ingest.sentry.io/1";
    process.env.SENTRY_ENVIRONMENT = "production";
    process.env.SENTRY_RELEASE = "attestation-fsa@3.0.1";
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0.25";

    expect(isSentryEnabled()).toBe(true);

    const options = buildSentryOptions("server");
    expect(options).toMatchObject({
      dsn: "https://key@example.ingest.sentry.io/1",
      environment: "production",
      release: "attestation-fsa@3.0.1",
      tracesSampleRate: 0.25,
      sendDefaultPii: false,
    });
    expect(typeof options?.beforeSend).toBe("function");
  });

  it("remonte l'erreur au SDK avec son contexte", async () => {
    process.env.SENTRY_DSN = "https://key@example.ingest.sentry.io/1";

    captureServerError(new Error("boom"), { route: "/api/x", status: 500 });

    await vi.waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: { route: "/api/x", status: 500 },
    });
  });

  it("le runtime client ne lit que NEXT_PUBLIC_SENTRY_DSN", () => {
    process.env.SENTRY_DSN = "https://server@example.ingest.sentry.io/1";

    expect(resolveSentryDsn("client")).toBeUndefined();

    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://client@example.ingest.sentry.io/2";

    expect(resolveSentryDsn("client")).toBe(
      "https://client@example.ingest.sentry.io/2",
    );
    expect(resolveSentryDsn("server")).toBe(
      "https://server@example.ingest.sentry.io/1",
    );
  });

  it("ignore les taux d'échantillonnage invalides sans lever d'exception", () => {
    process.env.SENTRY_TRACES_SAMPLE_RATE = "abc";
    expect(resolveSentryTracesSampleRate()).toBe(0);

    process.env.SENTRY_TRACES_SAMPLE_RATE = "-1";
    expect(resolveSentryTracesSampleRate()).toBe(0);

    process.env.SENTRY_TRACES_SAMPLE_RATE = "1.5";
    expect(resolveSentryTracesSampleRate()).toBe(0);

    process.env.SENTRY_TRACES_SAMPLE_RATE = "1";
    expect(resolveSentryTracesSampleRate()).toBe(1);
  });
});
