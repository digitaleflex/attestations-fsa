import { describe, it, expect, afterEach } from "vitest";
import {
  APP_TIMEZONE,
  appDayKey,
  describeCountdown,
  formatAppDate,
  formatAppDateTime,
  formatDurationMinutes,
  fromAppWallClock,
  getCountdownParts,
  getScheduleView,
  isStartAfterOpening,
  padCountdown,
  resolveOpensOn,
  startOfAppDay,
  toAppWallClock,
  toDate,
} from "@/lib/exams/schedule-ui";

/**
 * Planning côté interface (#m9/exam-ui).
 *
 * Ces tests verrouillent deux choses que rien d'autre ne vérifie :
 *  1. l'heure affichée est TOUJOURS Africa/Porto-Novo, quelle que soit la
 *     machine qui exécute le test (le process peut être en UTC, en Paris, ou
 *     au Ghana) ;
 *  2. avant le jour J, l'interface n'a le droit de montrer ni contenu ni lien
 *     de démarrage.
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** Deux instants de référence bien lus : 08:00 à Porto-Novo = 07:00 UTC. */
const SCHEDULED_UTC = "2026-09-26T07:00:00.000Z"; // 26/09 08:00
const OPENS_ON_UTC = "2026-09-25T23:00:00.000Z"; // minuit 26/09 à Porto-Novo

describe("fuseau de référence", () => {
  it("vaut Africa/Porto-Novo", () => {
    expect(APP_TIMEZONE).toBe("Africa/Porto-Novo");
  });

  it("convertit 08:00 Porto-Novo en 07:00 UTC, quel que soit le TZ du serveur", () => {
    // Le PIÈGE : si l'implémentation lisait l'heure de la machine, ce test
    // passerait en UTC (process.env.TZ = "UTC") et échouerait au Ghana.
    for (const tz of ["UTC", "Africa/Porto-Novo", "Europe/Paris", "Africa/Accra"]) {
      process.env.TZ = tz;
      expect(fromAppWallClock("2026-09-26T08:00")?.toISOString()).toBe(SCHEDULED_UTC);
      expect(toAppWallClock(SCHEDULED_UTC)).toBe("2026-09-26T08:00");
    }
  });

  it("fait du minuit local le premier instant de la journée, pas celui d'UTC", () => {
    process.env.TZ = "UTC";
    const open = startOfAppDay(SCHEDULED_UTC);
    // Minuit à Porto-Novo = 23:00 UTC LA VEILLE. Prendre minuit UTC décalerait
    // l'ouverture d'une heure en arrière sur toute la journée.
    expect(open?.toISOString()).toBe(OPENS_ON_UTC);
    expect(appDayKey(open)).toBe("2026-09-26");
  });

  it("affiche les horaires en heure de l'application, pas en heure de machine", () => {
    for (const tz of ["UTC", "Europe/Paris", "Africa/Porto-Novo"]) {
      process.env.TZ = tz;
      expect(formatAppDateTime(SCHEDULED_UTC)).toBe("26/09/2026 08:00");
      expect(formatAppDate(SCHEDULED_UTC)).toBe("26/09/2026");
    }
  });

  it("fait un aller-retour identité entre heure murale et instant UTC", () => {
    process.env.TZ = "Africa/Accra"; // UTC+0 : le décalage le plus piégeux
    const wall = "2026-12-31T23:30";
    expect(toAppWallClock(fromAppWallClock(wall))).toBe(wall);
  });

  it("refuse une valeur illisible plutôt que de produire une date invalide", () => {
    expect(toDate("pas une date")).toBeNull();
    expect(toDate("")).toBeNull();
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toAppWallClock("n'importe quoi")).toBeNull();
    expect(formatAppDateTime(undefined)).toBe("—");
  });
});

describe("jour d'ouverture (opensOn)", () => {
  it("utilise le champ renvoyé par l'API quand il existe", () => {
    const { opensAt, isFallback } = resolveOpensOn({
      opensOn: OPENS_ON_UTC,
      scheduledAt: SCHEDULED_UTC,
    });
    expect(opensAt?.toISOString()).toBe(OPENS_ON_UTC);
    expect(isFallback).toBe(false);
  });

  it("retombe sur la journée locale de scheduledAt tant que le champ manque", () => {
    // Repli imposé par la spécification pour les examens existants : sans lui,
    // la migration en cours ferait clignoter toutes les cartes « à venir ».
    const { opensAt, isFallback } = resolveOpensOn({ scheduledAt: SCHEDULED_UTC });
    expect(opensAt?.toISOString()).toBe(OPENS_ON_UTC);
    expect(isFallback).toBe(true);
  });

  it("détecte une heure de démarrage antérieure à l'ouverture", () => {
    expect(
      isStartAfterOpening({ opensOn: OPENS_ON_UTC, scheduledAt: "2026-09-25T20:00:00Z" }),
    ).toBe(true);
    expect(isStartAfterOpening({ opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC })).toBe(false);
  });
});

describe("ce que l'interface est autorisée à montrer", () => {
  it("J-1 : verrouillé, aucun contenu révélé, le compte à rebours vise l'ouverture", () => {
    const view = getScheduleView(
      { opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC },
      new Date("2026-09-25T10:00:00Z"),
    );
    expect(view.phase).toBe("LOCKED");
    expect(view.revealDetails).toBe(false);
    expect(view.canStart).toBe(false);
    // Avant l'ouverture, l'information utile est « ça ouvre quand », pas
    // « l'épreuve commence dans 21 h ».
    expect(view.countdownTarget?.toISOString()).toBe(OPENS_ON_UTC);
  });

  it("le jour J à 00:00 pile : l'examen devient visible", () => {
    const view = getScheduleView(
      { opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC },
      new Date(OPENS_ON_UTC),
    );
    expect(view.phase).toBe("ANNOUNCED");
    expect(view.revealDetails).toBe(true);
    expect(view.canStart).toBe(false);
    expect(view.countdownTarget?.toISOString()).toBe(SCHEDULED_UTC);
  });

  it("le jour J avant l'heure prévue : visible mais pas encore démarrable", () => {
    const view = getScheduleView(
      { opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC },
      new Date("2026-09-26T05:00:00Z"),
    );
    expect(view.phase).toBe("ANNOUNCED");
    expect(view.canStart).toBe(false);
  });

  it("à l'heure prévue : démarrable, plus de compte à rebours", () => {
    const view = getScheduleView(
      { opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC },
      new Date(SCHEDULED_UTC),
    );
    expect(view.phase).toBe("STARTABLE");
    expect(view.canStart).toBe(true);
    expect(view.countdownTarget).toBeNull();
  });

  it("laisse le serveur trancher quand il donne un verdict explicite", () => {
    // Le serveur a la dernière parole : `isAvailable: false` ferme le
    // démarrage même à l'heure, `true` l'ouvre même en avance.
    expect(
      getScheduleView(
        { opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC, isAvailable: false },
        new Date(SCHEDULED_UTC),
      ).canStart,
    ).toBe(false);
    expect(
      getScheduleView(
        { opensOn: OPENS_ON_UTC, scheduledAt: SCHEDULED_UTC, isAvailable: true },
        new Date("2026-09-20T00:00:00Z"),
      ).canStart,
    ).toBe(true);
  });

  it("sans date de démarrage, rien n'est annoncé comme jouable", () => {
    const view = getScheduleView({ status: "SCHEDULED" }, new Date());
    expect(view.phase).toBe("LOCKED");
    expect(view.canStart).toBe(false);
    expect(view.countdownTarget).toBeNull();
  });
});

describe("décompte", () => {
  const now = new Date("2026-09-26T05:00:00Z");

  it("découpe en unités pleines", () => {
    const parts = getCountdownParts("2026-09-28T07:30:45Z", now);
    expect(parts).toMatchObject({ days: 2, hours: 2, minutes: 30, seconds: 45 });
    expect(parts.isPast).toBe(false);
  });

  it("compte zéro une fois l'échéance passée, sans négatif", () => {
    const parts = getCountdownParts("2026-09-26T04:00:00Z", now);
    expect(parts.isPast).toBe(true);
    expect(parts.totalMs).toBe(0);
    expect(parts.seconds).toBe(0);
  });

  it("garde deux chiffres pour un chronomètre stable", () => {
    expect(padCountdown(0)).toBe("00");
    expect(padCountdown(7)).toBe("07");
    expect(padCountdown(42)).toBe("42");
    // Un chrono qui fait clignoter la largeur à chaque tick est illisible.
    expect(padCountdown(3)).toHaveLength(2);
  });

  it("compose une phrase annoncée aux lecteurs d'écran, une fois par minute", () => {
    const parts = getCountdownParts("2026-09-26T05:03:20Z", now);
    // Ni « 0 heure » inutile, ni pluriel faux.
    expect(describeCountdown(parts, "Ouverture de l'épreuve")).toBe(
      "Ouverture de l'épreuve : 3 minutes.",
    );
    expect(
      describeCountdown(getCountdownParts("2026-09-27T06:05:00Z", now), "Ouverture"),
    ).toBe("Ouverture : 1 jour, 1 heure, 5 minutes.");
  });
});

describe("durée d'épreuve", () => {
  it("convertit les secondes en minutes lisibles", () => {
    expect(formatDurationMinutes(3600)).toBe("60 min");
    expect(formatDurationMinutes(5400)).toBe("90 min");
  });

  it("ne montre rien plutôt qu'un « 0 min » trompeur", () => {
    expect(formatDurationMinutes(0)).toBeNull();
    expect(formatDurationMinutes(null)).toBeNull();
    expect(formatDurationMinutes(undefined)).toBeNull();
    expect(formatDurationMinutes(Number.NaN)).toBeNull();
  });
});
