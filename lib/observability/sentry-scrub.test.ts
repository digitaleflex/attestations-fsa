import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ErrorEvent } from "@sentry/nextjs";

import { buildSentryOptions, resolveSentryDsn } from "./sentry-config";
import {
  hashOpaqueId,
  redactSensitiveText,
  scrubSentryEvent,
  scrubSentryTransaction,
  type SentryTransactionEvent,
} from "./sentry-scrub";

const SENTRY_ENV_KEYS = ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  savedEnv.clear();
  for (const key of SENTRY_ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const RAW_USER_ID = "11111111-1111-1111-1111-111111111111";

function buildSensitiveEvent(): ErrorEvent {
  return {
    event_id: "e1",
    type: undefined,
    message: "Echec du traitement pour dave@example.com",
    extra: {
      route: "/api/x",
      operation: "create-user",
      userId: RAW_USER_ID,
      query: "SELECT * FROM users WHERE email = 'alice@example.com'",
      detail: "SELECT id FROM users WHERE email = 'bob@example.com'",
      rowsReturned: 3,
    },
    request: {
      url: "https://app.example.com/api/x?email=alice@example.com&token=super-secret",
      method: "POST",
      cookies: { session: "sess-123" },
      headers: {
        authorization: "Bearer top-secret",
        cookie: "session=sess-123",
      },
      query_string: "email=alice@example.com&token=super-secret",
      data: { email: "alice@example.com", password: "hunter2" },
      env: { DATABASE_URL: "postgres://user:pass@host/db" },
    },
    user: {
      id: "user-uuid-0001",
      email: "alice@example.com",
      username: "alice",
      ip_address: "203.0.113.7",
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "Prisma: SELECT * FROM users WHERE email = 'alice@example.com'",
        },
      ],
    },
    breadcrumbs: [
      {
        message: "console.error pour alice@example.com",
        data: { args: ["SELECT 1 FROM users"] },
      },
    ],
  };
}

describe("scrubbing PII avant envoi à Sentry (#153)", () => {
  it("retire email, SQL, cookies, en-têtes et corps de l'événement", async () => {
    const scrubbed = await scrubSentryEvent(buildSensitiveEvent());
    const serialized = JSON.stringify(scrubbed);

    for (const secret of [
      "@example.com",
      "SELECT",
      "hunter2",
      "top-secret",
      "sess-123",
      "super-secret",
      "203.0.113.7",
      "postgres://",
    ]) {
      expect(serialized).not.toContain(secret);
    }

    // Requête assainie mais encore exploitable pour le diagnostic.
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.env).toBeUndefined();
    expect(scrubbed.request?.url).toBe("https://app.example.com/api/x");
    expect(scrubbed.request?.method).toBe("POST");
  });

  it("nettoie extra : clés sensibles supprimées, valeurs SQL neutralisées", async () => {
    const scrubbed = await scrubSentryEvent(buildSensitiveEvent());

    expect(scrubbed.extra).not.toHaveProperty("query");
    expect(scrubbed.extra?.detail).toBe("[sql]");
    // L'information non sensible est conservée.
    expect(scrubbed.extra?.route).toBe("/api/x");
    expect(scrubbed.extra?.operation).toBe("create-user");
    expect(scrubbed.extra?.rowsReturned).toBe(3);
  });

  it("remplace le userId brut par un condensé non réversible", async () => {
    const scrubbed = await scrubSentryEvent(buildSensitiveEvent());

    const expected = await hashOpaqueId(RAW_USER_ID);
    expect(expected).toBeTruthy();
    expect(scrubbed.extra?.userId).toBe(expected);
    expect(scrubbed.extra?.userId).not.toBe(RAW_USER_ID);
  });

  it("réduit event.user à un identifiant haché (jamais email/nom/IP)", async () => {
    const scrubbed = await scrubSentryEvent(buildSensitiveEvent());

    expect(scrubbed.user?.email).toBeUndefined();
    expect(scrubbed.user?.username).toBeUndefined();
    expect(scrubbed.user?.ip_address).toBeUndefined();
    expect(typeof scrubbed.user?.id).toBe("string");
    expect(scrubbed.user?.id).not.toBe("user-uuid-0001");
  });

  it("supprime event.user quand aucun identifiant opaque n'existe", async () => {
    const event = {
      user: { email: "alice@example.com", username: "alice" },
    } as ErrorEvent;

    const scrubbed = await scrubSentryEvent(event);
    expect(scrubbed.user).toBeUndefined();
  });

  it("assainit message, exception et breadcrumbs", async () => {
    const scrubbed = await scrubSentryEvent(buildSensitiveEvent());

    expect(scrubbed.message).toBe("Echec du traitement pour [email]");
    expect(scrubbed.exception?.values?.[0].value).not.toContain("@example.com");
    expect(scrubbed.exception?.values?.[0].value).not.toMatch(/SELECT/i);
    expect(scrubbed.breadcrumbs?.[0].message).not.toContain("@example.com");
    expect(scrubbed.breadcrumbs?.[0].data).not.toHaveProperty("args");
  });

  it("ne détruit pas un événement anodin", async () => {
    const anodyne = {
      event_id: "ok",
      type: undefined,
      message: "Payment gateway timeout",
      level: "error",
      extra: { route: "/api/pay", status: 504, operation: "create-payment" },
      exception: { values: [{ type: "Error", value: "Upstream timeout" }] },
      request: { url: "https://app.example.com/api/pay", method: "POST" },
    } as ErrorEvent;

    const snapshot = JSON.parse(JSON.stringify(anodyne));
    const scrubbed = await scrubSentryEvent(anodyne);

    expect(JSON.parse(JSON.stringify(scrubbed))).toEqual(snapshot);
  });

  it("assainit aussi les spans des transactions (SQL Prisma)", async () => {
    const transaction = {
      type: "transaction",
      transaction: "/api/x",
      spans: [
        {
          description: "SELECT * FROM users WHERE email = 'a@b.com'",
          data: {
            "db.statement": "SELECT 1 FROM users",
            "http.query": "email=a@b.com",
          },
        },
      ],
    } as unknown as SentryTransactionEvent;

    const scrubbed = await scrubSentryTransaction(transaction);
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain("@b.com");
    expect(serialized).not.toMatch(/SELECT/i);
    expect(scrubbed.spans?.[0].data).not.toHaveProperty("db.statement");
    expect(scrubbed.spans?.[0].data).not.toHaveProperty("http.query");
  });

  it("redactSensitiveText reste inoffensif sur un texte anodin", () => {
    expect(redactSensitiveText("Failed to update profile")).toBe(
      "Failed to update profile",
    );
    expect(redactSensitiveText("user alice@example.com")).toBe(
      "user [email]",
    );
  });
});

describe("no-op et câblage des protections (#151/#153)", () => {
  it("sans DSN : buildSentryOptions reste null (no-op intact)", () => {
    expect(resolveSentryDsn()).toBeUndefined();
    expect(buildSentryOptions("server")).toBeNull();
    expect(buildSentryOptions("client")).toBeNull();
  });

  it("avec DSN : sendDefaultPii=false et beforeSend câblés", () => {
    process.env.SENTRY_DSN = "https://key@example.ingest.sentry.io/1";

    const options = buildSentryOptions("server");
    expect(options?.sendDefaultPii).toBe(false);
    expect(options?.beforeSend).toBe(scrubSentryEvent);
    expect(options?.beforeSendTransaction).toBe(scrubSentryTransaction);
  });
});
