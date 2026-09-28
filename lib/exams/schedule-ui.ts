/**
 * Planning des examens côté interface (#m9/exam-ui).
 *
 * Ce module est voluntarily dépourvu de Prisma : il tourne dans le navigateur
 * (cartes countdown, liste candidat, formulaire admin) ET dans les tests. Il ne
 * fait qu'un seul travail : parler de l'heure d'ouverture d'un examen dans le
 * fuseau de référence de l'application, et décider ce que l'interface a le
 * droit de montrer AVANT l'ouverture.
 *
 * Règle unique (cf. docs/superpowers/specs/2026-09-25-exam-scheduling-design.md) :
 * `opensOn` = début de la journée d'ouverture, interprété dans
 * `APP_TIMEZONE`. `scheduledAt` = heure effective de démarrage, stockée en UTC.
 * Aucune comparaison ne doit utiliser le fuseau du navigateur ni celui de la
 * machine hôte : deux candidats au Ghana et au Bénin doivent voir la même
 * heure d'ouverture, et un admin qui édite à 23h ne doit pas décaler l'épreuve
 * d'un jour parce que sa machine est en UTC.
 *
 * Aucun calcul n'utilise `getHours()`/`getDate()`/`toLocaleString()` sans
 * `timeZone` : ces méthodes lisent le fuseau de la machine.
 */

/** Fuseau de référence de l'application. Fixé par la spécification. */
export const APP_TIMEZONE = "Africa/Porto-Novo";

/** Libellé affiché aux candidats et aux admins (le fuseau n'est pas deviné). */
export const APP_TIMEZONE_LABEL = "Africa/Porto-Novo (UTC+1)";

/** Acronyme court pour les zones où l'espace manque (badges, colonnes). */
export const APP_TIMEZONE_SHORT = "Porto-Novo";

export type DateLike = string | number | Date | null | undefined;

export type ScheduleInput = {
  /** Jour d'ouverture, stocké en UTC. Absent tant que l'API ne l'expose pas. */
  opensOn?: DateLike;
  /** Heure effective de démarrage, stockée en UTC. */
  scheduledAt?: DateLike;
  /**
   * Verdict du serveur. `true` ouvre le démarrage, `false` le ferme, `null`
   * / `undefined` laisse la décision à l'horloge locale (contrat antérieur).
   */
  isAvailable?: boolean | null;
  status?: string | null;
};

/**
 * Trois moments, pas quatre : l'interface n'a pas besoin de distinguer
 * « programmé » de « dans 3 jours » — elle a besoin de savoir si elle a le
 * droit de montrer le contenu.
 */
export type SchedulePhase =
  /** Avant le jour J : ni description, ni barème, ni durée, ni lien. */
  | "LOCKED"
  /** Jour J ouvert, heure de démarrage pas atteinte : visible, pas jouable. */
  | "ANNOUNCED"
  /** Heure de démarrage atteinte : le lien « Commencer » existe. */
  | "STARTABLE";

export type ScheduleView = {
  phase: SchedulePhase;
  /** Minuit Africa/Porto-Novo du jour d'ouverture (ou repli calculé). */
  opensAt: Date | null;
  /** `scheduledAt` normalisé. */
  startsAt: Date | null;
  /** Le contenu de l'épreuve peut-il être affiché ? */
  revealDetails: boolean;
  /** L'interface peut-elle proposer « Commencer » ? */
  canStart: boolean;
  /** Cible du compte à rebours, ou `null` s'il n'y a plus rien à compter. */
  countdownTarget: Date | null;
  /** Vrai si `opensOn` est extrapolé faute de champ renvoyé par l'API. */
  opensOnIsFallback: boolean;
};

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Convertit une valeur API en `Date`, ou `null` si elle est absente/illisible. */
export function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type WallClock = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Heure « murale » d'un instant dans un fuseau donné.
 *
 * `hourCycle: "h23"` est explicite parce que `hour12: false` rend 24 pour minuit
 * sur certains runtimes ICU — et 24h03 n'est pas une heure.
 */
function getWallClock(date: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part ? Number(part.value) : 0;
  };

  const hour = read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: hour === 24 ? 0 : hour,
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Décalage du fuseau par rapport à UTC, en millisecondes, à l'instant donné.
 *
 * Africa/Porto-Novo est à UTC+1 en permanence, mais le calcul reste générique :
 * il ne fige pas une hypothèse que le fuseau pourrait un jour changer, et il
 * reste correct pour un fuseau à heure d'été.
 */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const wall = getWallClock(date, timeZone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  // L'alignement à la seconde évite que les millisecondes de `date` ne
  // faussent la différence.
  return asUtc - Math.floor(date.getTime() / MS_PER_SECOND) * MS_PER_SECOND;
}

/**
 * Minuit Africa/Porto-Novo de l'instant donné, en UTC.
 *
 * 00:00 à Porto-Novo = 23:00 UTC la veille. C'est exactement l'instant que le
 * cron compare pour basculer `SCHEDULED -> PUBLISHED`, donc c'est exactement
 * celui que l'interface doit comparer pour masquer le contenu.
 */
export function startOfAppDay(value: DateLike): Date | null {
  const date = toDate(value);
  if (!date) return null;

  const wall = getWallClock(date, APP_TIMEZONE);
  const midnightWall = Date.UTC(wall.year, wall.month - 1, wall.day, 0, 0, 0);

  // Deux passes : le décalage est recalculé sur l'instant estimé, ce qui absorbe
  // un basculement d'heure d'été survenu entre les deux.
  let guess = midnightWall - getTimeZoneOffsetMs(date, APP_TIMEZONE);
  guess = midnightWall - getTimeZoneOffsetMs(new Date(guess), APP_TIMEZONE);
  return new Date(guess);
}

/**
 * `opensOn` effectif.
 *
 * Repli de la spécification : si l'API ne renvoie pas encore `opensOn`, on
 * prend la journée locale de `scheduledAt`. L'interface reste donc correcte
 * pendant que la migration est en cours, et se resserre toute seule quand le
 * champ arrive.
 */
export function resolveOpensOn(
  schedule: Pick<ScheduleInput, "opensOn" | "scheduledAt">,
): { opensAt: Date | null; isFallback: boolean } {
  const explicit = toDate(schedule.opensOn);
  if (explicit) return { opensAt: explicit, isFallback: false };
  return { opensAt: startOfAppDay(schedule.scheduledAt), isFallback: true };
}

/** Décide de ce que l'interface a le droit de montrer. */
export function getScheduleView(
  schedule: ScheduleInput,
  now: Date = new Date(),
): ScheduleView {
  const startsAt = toDate(schedule.scheduledAt);
  const { opensAt, isFallback } = resolveOpensOn(schedule);

  // Le serveur reste maître quand il tranche (`isAvailable` présent) : ne pas
  // inventer un démarrage que l'API refuse d'ouvrir.
  let canStart: boolean;
  if (schedule.isAvailable === true) {
    canStart = true;
  } else if (schedule.isAvailable === false) {
    canStart = false;
  } else {
    canStart = startsAt !== null && now.getTime() >= startsAt.getTime();
  }

  const phase: SchedulePhase = canStart
    ? "STARTABLE"
    : opensAt && now.getTime() >= opensAt.getTime()
      ? "ANNOUNCED"
      : "LOCKED";

  // Avant le jour J, on ne montre QUE l'identifiant, le titre, la date
  // d'ouverture et l'heure prévue. Le compte à rebours vise d'abord l'ouverture
  // (c'est l'information utile : « ça ouvre quand ? »), puis l'heure de
  // démarrage.
  const countdownTarget =
    phase === "STARTABLE"
      ? null
      : phase === "ANNOUNCED"
        ? startsAt
        : opensAt;

  return {
    phase,
    opensAt,
    startsAt,
    revealDetails: phase !== "LOCKED",
    canStart,
    countdownTarget,
    opensOnIsFallback: isFallback,
  };
}

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isPast: boolean;
};

/** Décompte restant avant `target`, en unités pleines. */
export function getCountdownParts(
  target: DateLike,
  now: Date = new Date(),
): CountdownParts {
  const targetDate = toDate(target);
  if (!targetDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true };
  }

  const totalMs = targetDate.getTime() - now.getTime();
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true };
  }

  return {
    days: Math.floor(totalMs / MS_PER_DAY),
    hours: Math.floor((totalMs % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((totalMs % MS_PER_MINUTE) / MS_PER_SECOND),
    totalMs,
    isPast: false,
  };
}

/** Deux chiffres pour un chronomètre : « 03 » et non « 3 ». */
export function padCountdown(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

/**
 * Phrase lue une fois par minute par les lecteurs d'écran.
 *
 * Le décompte à la seconde est décoré de `aria-hidden` (bruit inutile) ; c'est
 * cette phrase, rafraîchie au changement de minute, qui porte l'information.
 */
export function describeCountdown(parts: CountdownParts, label: string): string {
  if (parts.isPast) return `${label} : c'est parti.`;
  const chunks: string[] = [];
  if (parts.days > 0) chunks.push(`${parts.days} jour${parts.days > 1 ? "s" : ""}`);
  if (parts.hours > 0 || parts.days > 0) chunks.push(`${parts.hours} heure${parts.hours > 1 ? "s" : ""}`);
  chunks.push(`${parts.minutes} minute${parts.minutes > 1 ? "s" : ""}`);
  return `${label} : ${chunks.join(", ")}.`;
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let formatter = dateTimeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: APP_TIMEZONE,
      ...options,
    });
    dateTimeFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Affiche un instant UTC en heure Africa/Porto-Novo.
 *
 * Le nom du fuseau est affiché par l'appelant : une heure sans fuseau écrit
 * dans un pays à deux fuseaux zwéberait.
 */
export function formatInAppTimezone(
  value: DateLike,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  const date = toDate(value);
  if (!date) return "—";
  return getDateTimeFormatter(options).format(date);
}

/** « 26/09/2026 08:00 » en heure locale de l'application. */
export function formatAppDateTime(value: DateLike): string {
  return formatInAppTimezone(value);
}

/** « 26/09/2026 » en heure locale de l'application. */
export function formatAppDate(value: DateLike): string {
  return formatInAppTimezone(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** « samedi 26 septembre 2026 » — pour les titres de section. */
export function formatAppLongDate(value: DateLike): string {
  return formatInAppTimezone(value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Clé de journée locale « 2026-09-26 », indépendante de la machine hôte. */
export function appDayKey(value: DateLike): string | null {
  const wall = value === null || value === undefined ? null : getWallClock(toDate(value) as Date, APP_TIMEZONE);
  if (!wall) return null;
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`;
}

/**
 * Valeur « 2026-09-26T08:00 »interpretée dans le fuseau de l'application.
 *
 * Utilisée par le formulaire admin pour convertir une heure murale
 * Africa/Porto-Novo en l'instant UTC correspondant. Le `<input type="time">`
 * et le `DateInput` restent en heure murale : c'est le seul format qu'un admin
 * peut vérifier à l'œil nu.
 */
export function toAppWallClock(value: DateLike): string | null {
  const date = toDate(value);
  if (!date) return null;
  const wall = getWallClock(date, APP_TIMEZONE);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = String(wall.year).padStart(4, "0");
  return `${year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/**
 * Convertit une heure murale Africa/Porto-Novo en instant UTC.
 *
 * Symétrique de {@link toAppWallClock}. Un aller-retour est l'identité, ce qui
 * garantit qu'éditer un examen ne décale jamais son heure d'un jour.
 */
export function fromAppWallClock(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const wallUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    0,
  );

  let guess = wallUtc - getTimeZoneOffsetMs(new Date(wallUtc), APP_TIMEZONE);
  guess = wallUtc - getTimeZoneOffsetMs(new Date(guess), APP_TIMEZONE);
  return new Date(guess);
}

/** Vrai si l'heure de démarrage est postérieure à l'ouverture. */
export function isStartAfterOpening(schedule: ScheduleInput): boolean {
  const startsAt = toDate(schedule.scheduledAt);
  const { opensAt } = resolveOpensOn(schedule);
  if (!startsAt || !opensAt) return false;
  return startsAt.getTime() < opensAt.getTime();
}

/** Durée d'épreuve en minutes lisibles (« 90 min »), ou `null`. */
export function formatDurationMinutes(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
