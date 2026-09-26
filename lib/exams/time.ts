/**
 * Base temporelle du planning des examens (design M9).
 *
 * Invariants :
 *   * le stockage est TOUJOURS en UTC (PostgreSQL `timestamp without time zone`
 *     alimenté par Prisma avec des `Date` JavaScript, donc des instants) ;
 *   * la seule date calendaire locale de référence est `APP_TIMEZONE`
 *     (défaut : `Africa/Porto-Novo`, UTC+1, Bénin) ;
 *   * aucune comparaison ne doit utiliser le fuseau du navigateur ni celui de
 *     la machine hôte : tout est calculé via `Intl` avec un `timeZone` explicite.
 *
 * Règle « jour J » : un examen devient visible à `00:00:00` en `APP_TIMEZONE`
 * le jour de son ouverture — pas à l'heure locale de `scheduledAt`.
 */

/** Fuseau applicatif par défaut (surchargeable via `APP_TIMEZONE`). */
export const DEFAULT_APP_TIMEZONE = "Africa/Porto-Novo";

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    // `Intl` accepte les alias (UTC, Etc/GMT+1…) : la construction suffit.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fuseau applicatif effectif : `APP_TIMEZONE` si valide, sinon le défaut.
 * Un fuseau mal configuré ne doit jamais faire planter une route.
 */
export function getAppTimeZone(): string {
  const configured = process.env.APP_TIMEZONE?.trim();
  if (configured && isValidTimeZone(configured)) return configured;
  return DEFAULT_APP_TIMEZONE;
}

type DateLike = Date | string | number;

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

function isUsable(value: DateLike | null | undefined): value is DateLike {
  if (value == null) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "number") return Number.isFinite(value);
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Décalage du fuseau (ms, est−ouest) à l'instant `date`. */
export function timeZoneOffsetMs(
  date: Date = new Date(),
  timeZone: string = getAppTimeZone(),
): number {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const raw: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") raw[part.type] = Number(part.value);
  }
  // `hour12: false` peut rendre minuit « 24 » selon l'implémentation ICU.
  const hour = raw.hour === 24 ? 0 : raw.hour;
  const asUtc = Date.UTC(
    raw.year,
    raw.month - 1,
    raw.day,
    hour,
    raw.minute,
    raw.second,
  );
  // L'offset est toujours multiple de 60 s : on arrondit pour absorber les
  // millisecondes de l'instant d'origine.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Horodatage calendaire local (`YYYY-MM-DDTHH:mm:ss`) de l'instant. */
export function localDateTimeString(
  value: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
): string {
  const date = toDate(value);
  const parts = partsFormatter(timeZone).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`;
}

/** Partie date seule (`YYYY-MM-DD`) de la date calendaire locale. */
export function localDayKey(
  value: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
): string {
  return localDateTimeString(value, timeZone).slice(0, 10);
}

/**
 * Instant UTC correspondant à `00:00:00` du jour calendaire local contenant
 * `value`. Deux passes : la seconde corrige le cas limite des transitions DST.
 */
export function startOfLocalDay(
  value: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
): Date {
  const day = localDayKey(value, timeZone);
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, dayOfMonth, 0, 0, 0);
  let ts = naive - timeZoneOffsetMs(new Date(naive), timeZone);
  ts = naive - timeZoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** `true` si `value` est le premier jour calendaire local (minuit PileOuFace). */
export function isLocalMidnight(
  value: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
): boolean {
  return startOfLocalDay(value, timeZone).getTime() === toDate(value).getTime();
}

export interface OpensOnSource {
  opensOn?: DateLike | null;
  scheduledAt?: DateLike | null;
}

/**
 * `opensOn` effectif d'un examen, ramené au minuit du jour d'ouverture.
 *
 * Repli pour les examens existants (`opensOn IS NULL`) : le jour local de
 * `scheduledAt`. Sans aucune des deux dates, l'examen n'a pas d'ouverture.
 */
export function resolveOpensOn(
  exam: OpensOnSource,
  timeZone: string = getAppTimeZone(),
): Date | null {
  if (isUsable(exam.opensOn)) return startOfLocalDay(exam.opensOn, timeZone);
  if (isUsable(exam.scheduledAt)) {
    return startOfLocalDay(exam.scheduledAt, timeZone);
  }
  return null;
}

/** `true` si le jour calendaire local de `a` et de `b` est le même. */
export function isSameLocalDay(
  a: DateLike,
  b: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
): boolean {
  return localDayKey(a, timeZone) === localDayKey(b, timeZone);
}

// ---------------------------------------------------------------------------
// Règle unique d'ouverture — une seule implémentation, partagée par TOUTES les
// surfaces (routes publiques, routes candidat, disponibilité, 423).
//
// Un examen est ouvert (donc lisible et démarrable) si et seulement si :
//   1. son statut est publiable (`SCHEDULED` ou `PUBLISHED`) ;
//   2. le jour J est atteint — minuit `APP_TIMEZONE` de `opensOn` (ou, pour les
//      examens historiques sans `opensOn`, de `scheduledAt`) ;
//   3. `scheduledAt` est défini ET atteint.
//
// Le point 3 est ce qui distingue l'ANNONCE (visible dès le jour J) du
// DÉMARRAGE (autorisé à l'heure prévue) : le compte à rebours de l'interface
// continue de tourner entre les deux.
// ---------------------------------------------------------------------------

/** Statuts pour lesquels un examen peut être ouvert. */
export const OPENABLE_EXAM_STATUSES = ["SCHEDULED", "PUBLISHED"] as const;

export type OpenableExamStatus = (typeof OPENABLE_EXAM_STATUSES)[number];

function isOpenableStatus(status: unknown): status is OpenableExamStatus {
  return (
    typeof status === "string" &&
    (OPENABLE_EXAM_STATUSES as readonly string[]).includes(status)
  );
}

/** Champs d'examen nécessaires à la règle d'ouverture. */
export interface ExamScheduleSource extends OpensOnSource {
  status?: string | null;
  /** Champs d'annonce, jamais de contenu : uniquement pour `lockedPayload`. */
  id?: string | null;
  title?: string | null;
  name?: string | null;
}

/**
 * Instant d'OUVERTURE effectif d'un examen (minuit du jour J en
 * `APP_TIMEZONE`). Rôle unique : alimenter les annonces (`opensAt`) et le
 * compte à rebours. `null` = aucune date exploitable, donc jamais visible.
 */
export function opensOn(
  exam: OpensOnSource,
  timeZone: string = getAppTimeZone(),
): Date | null {
  return resolveOpensOn(exam, timeZone);
}

/**
 * Règle « jour J ET heure prévue » : l'examen est-il réellement accessible ?
 *
 * `false` couvre les trois refus applicatifs : statut non publiable (DRAFT,
 * ARCHIVED), jour J non atteint, heure prévue non atteinte ou absente.
 */
export function hasOpened(
  exam: ExamScheduleSource,
  now: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
): boolean {
  if (!isOpenableStatus(exam.status)) return false;
  if (!isUsable(exam.scheduledAt)) return false;
  const opensAt = opensOn(exam, timeZone);
  if (opensAt == null) return false;
  return (
    opensAt.getTime() <= toDate(now).getTime() &&
    toDate(exam.scheduledAt).getTime() <= toDate(now).getTime()
  );
}

/**
 * Corps de la réponse `423 EXAM_LOCKED`.
 *
 * Champs de planning et d'annonce UNIQUEMENT (jamais de description, de barème,
 * de durée, de volume de questions ni de contenu) : le refus ne doit rien
 * apprendre de plus que la date d'ouverture.
 */
export function lockedPayload(
  exam: ExamScheduleSource,
  now: DateLike = new Date(),
  timeZone: string = getAppTimeZone(),
) {
  const opensAt = opensOn(exam, timeZone);
  return {
    code: "EXAM_LOCKED",
    message: "Cet examen n'est pas encore ouvert.",
    id: exam.id ?? null,
    title: exam.title ?? exam.name ?? null,
    status: exam.status ?? null,
    scheduledAt: isUsable(exam.scheduledAt)
      ? toDate(exam.scheduledAt).toISOString()
      : null,
    opensAt: opensAt ? opensAt.toISOString() : null,
    locked: true,
  };
}
