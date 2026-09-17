import type {
  ErrorEvent,
  Event,
  NodeOptions,
  RequestEventData,
} from "@sentry/nextjs";

/**
 * Type exact de l'événement reçu par `beforeSendTransaction`.
 * `TransactionEvent` n'est pas exporté par `@sentry/nextjs` : on le dérive de
 * l'option SDK pour rester aligné sur la version installée.
 */
export type SentryTransactionEvent = Parameters<
  NonNullable<NodeOptions["beforeSendTransaction"]>
>[0];

/**
 * Scrubbing PII appliqué AVANT tout envoi à Sentry (#153, EPIC #148).
 *
 * Sentry est un tiers SaaS : aucun email, nom, identifiant utilisateur brut,
 * cookie, en-tête, query string, corps de requête ni SQL ne doit quitter le
 * périmètre. Ce module est pur (hors `hashOpaqueId`) et sans import runtime du
 * SDK, donc testable unitairement.
 */

/** Profondeur maximale de récursion dans `extra`, `data` et `breadcrumbs`. */
const MAX_SCRUB_DEPTH = 6;

/** Préfixe applicatif mélangé avant hachage (évite la corrélation inter-apps). */
const OPAQUE_ID_PREFIX = "fsa-attestations:";

/**
 * Fragments de clés (insensibles à la casse) dont la valeur est SUPPRIMÉE,
 * car susceptibles de contenir du SQL brut, des paramètres de requête ou des
 * données personnelles :
 * - credentials : password/passwd/pwd/passphrase, secret, token, apikey,
 *   authorization, auth, cookie, session, dsn ;
 * - PII : email/mail, phone/telephone/mobile, iban, ssn ;
 * - données de requête : sql, statement, query, param/args/argument, meta,
 *   body, payload.
 * La correspondance est un « contient », pour couvrir `userEmail`,
 * `passwordHash`, `sqlQuery`, `requestBody`, etc.
 */
export const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "passwd",
  "pwd",
  "passphrase",
  "secret",
  "token",
  "apikey",
  "api_key",
  "api-key",
  "authorization",
  "auth",
  "cookie",
  "session",
  "dsn",
  "email",
  "mail",
  "phone",
  "telephone",
  "mobile",
  "iban",
  "ssn",
  "sql",
  "statement",
  "query",
  "param",
  "args",
  "argument",
  "meta",
  "body",
  "payload",
] as const;

const SENSITIVE_KEY_REGEX = new RegExp(
  SENSITIVE_KEY_FRAGMENTS.join("|"),
  "i",
);

/** Clés dont la VALEUR est hachée (identifiant opaque) au lieu d'être supprimée. */
const OPAQUE_ID_KEYS = new Set(["userid", "user_id", "user-id"]);

const SQL_REGEX =
  /\b(?:select\b[\s\S]*?\bfrom\b|insert\s+into\b|update\b[\s\S]*?\bset\b|delete\s+from\b|truncate\s+table\b|alter\s+table\b|create\s+table\b)[\s\S]*/gi;
const JWT_REGEX =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Neutralise SQL, JWT et emails dans un texte libre (message, span, breadcrumb). */
export function redactSensitiveText(value: string): string {
  return value
    .replace(SQL_REGEX, "[sql]")
    .replace(JWT_REGEX, "[jwt]")
    .replace(EMAIL_REGEX, "[email]");
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_REGEX.test(key);
}

function isOpaqueIdKey(key: string): boolean {
  return OPAQUE_ID_KEYS.has(key.toLowerCase());
}

/**
 * Condensé SHA-256, tronqué, non réversible en pratique pour un identifiant
 * opaque (UUID). Retourne `undefined` si Web Crypto est indisponible : dans ce
 * cas l'appelant supprime l'identifiant plutôt que de le transmettre brut.
 */
export async function hashOpaqueId(
  value: string | number,
): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;

  try {
    const bytes = new TextEncoder().encode(
      `${OPAQUE_ID_PREFIX}${String(value)}`,
    );
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    )
      .join("")
      .slice(0, 32);
  } catch {
    return undefined;
  }
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

async function scrubValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): Promise<unknown> {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || typeof value !== "object" || depth <= 0) return value;

  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => scrubValue(item, depth - 1, seen)));
  }

  // On préserve les objets non triviaux (Error, Date…) : ils portent souvent
  // l'information de diagnostic et ne sont pas des conteneurs de données.
  if (!isPlainObject(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    const scrubbed = await scrubEntry(key, nested, depth - 1, seen);
    if (scrubbed !== undefined) result[key] = scrubbed;
  }
  return result;
}

async function scrubEntry(
  key: string,
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): Promise<unknown> {
  if (isSensitiveKey(key)) return undefined;

  if (
    isOpaqueIdKey(key) &&
    (typeof value === "string" || typeof value === "number")
  ) {
    return hashOpaqueId(value);
  }

  return scrubValue(value, depth, seen);
}

/** Nettoie en place un dictionnaire `extra` / `data` (récursif, borné). */
async function scrubRecord(
  record: Record<string, unknown> | undefined,
  depth = MAX_SCRUB_DEPTH,
): Promise<void> {
  if (!record) return;

  const seen = new WeakSet<object>();
  for (const key of Object.keys(record)) {
    const scrubbed = await scrubEntry(key, record[key], depth, seen);
    if (scrubbed === undefined) delete record[key];
    else record[key] = scrubbed;
  }
}

/**
 * Supprime cookies, en-têtes, query string, corps et variables d'environnement
 * de la requête, et retire la query string / le fragment de l'URL.
 */
export function scrubRequest(request?: RequestEventData): void {
  if (!request) return;

  delete request.cookies;
  delete request.headers;
  delete request.env;
  delete request.data;
  delete request.query_string;

  if (typeof request.url === "string") {
    request.url = request.url.split(/[?#]/)[0];
  }
}

/** Réduit `event.user` à un identifiant haché, ou le supprime. Jamais d'email. */
async function scrubUser(event: Event): Promise<void> {
  const user = event.user;
  if (!user) return;

  const rawId =
    typeof user.id === "string" || typeof user.id === "number"
      ? user.id
      : undefined;

  const hashed = rawId === undefined ? undefined : await hashOpaqueId(rawId);
  if (hashed === undefined) {
    delete event.user;
    return;
  }

  event.user = { id: hashed };
}

function scrubEventText(event: Event): void {
  if (typeof event.message === "string") {
    event.message = redactSensitiveText(event.message);
  }

  if (typeof event.logentry?.message === "string") {
    event.logentry.message = redactSensitiveText(event.logentry.message);
  }

  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === "string") {
      exception.value = redactSensitiveText(exception.value);
    }
  }
}

async function scrubBreadcrumbs(event: Event): Promise<void> {
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (typeof breadcrumb.message === "string") {
      breadcrumb.message = redactSensitiveText(breadcrumb.message);
    }

    if (breadcrumb.data) {
      await scrubRecord(breadcrumb.data as Record<string, unknown>);
    }
  }
}

async function scrubCommonEvent(event: Event): Promise<void> {
  scrubRequest(event.request);
  await scrubUser(event);
  await scrubRecord(event.extra as Record<string, unknown> | undefined);
  scrubEventText(event);
  await scrubBreadcrumbs(event);
}

/** `beforeSend` : scrubbing des événements d'erreur. */
export async function scrubSentryEvent(event: ErrorEvent): Promise<ErrorEvent> {
  await scrubCommonEvent(event);
  return event;
}

/** `beforeSendTransaction` : idem + spans (SQL Prisma, URL, corps HTTP). */
export async function scrubSentryTransaction(
  event: SentryTransactionEvent,
): Promise<SentryTransactionEvent> {
  await scrubCommonEvent(event);

  for (const span of event.spans ?? []) {
    if (typeof span.description === "string") {
      span.description = redactSensitiveText(span.description);
    }

    if (span.data) {
      await scrubRecord(span.data as Record<string, unknown>);
    }
  }

  return event;
}
