// M9 — Base temporelle du planning (design 2026-09-25).
// Invariants testés :
//   * stockage UTC, interprétation calendaire dans APP_TIMEZONE uniquement ;
//   * le fuseau de la machine hôte ne doit jamais changer le résultat
//     (chaque cas est vérifié sous TZ=UTC, TZ=Europe/Paris, TZ=Asia/Tokyo) ;
//   * « jour J » = minuit Africa/Porto-Novo du jour d'ouverture.

import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_APP_TIMEZONE,
  getAppTimeZone,
  isSameLocalDay,
  isValidTimeZone,
  localDateTimeString,
  localDayKey,
  resolveOpensOn,
  startOfLocalDay,
  timeZoneOffsetMs,
} from "../../../lib/exams/time";

const TZ = "Africa/Porto-Novo";
const originalTz = process.env.TZ;
const originalAppTz = process.env.APP_TIMEZONE;

function setMachineTz(value: string) {
  process.env.TZ = value;
}

afterEach(() => {
  process.env.TZ = originalTz;
  if (originalAppTz === undefined) delete process.env.APP_TIMEZONE;
  else process.env.APP_TIMEZONE = originalAppTz;
});

/** Exécute le même scénario sous plusieurs fuseaux machine. */
function forEachMachineTz(fn: () => void) {
  for (const tz of ["UTC", "Europe/Paris", "Asia/Tokyo", "America/New_York"]) {
    setMachineTz(tz);
    fn();
  }
}

describe("exams/time — configuration du fuseau", () => {
  it("le défaut est Africa/Porto-Novo", () => {
    expect(DEFAULT_APP_TIMEZONE).toBe("Africa/Porto-Novo");
  });

  it("APP_TIMEZONE valide est respecté", () => {
    process.env.APP_TIMEZONE = "Africa/Porto-Novo";
    expect(getAppTimeZone()).toBe("Africa/Porto-Novo");
    process.env.APP_TIMEZONE = "UTC";
    expect(getAppTimeZone()).toBe("UTC");
  });

  it("APP_TIMEZONE absent ou invalide retombe sur le défaut", () => {
    delete process.env.APP_TIMEZONE;
    expect(getAppTimeZone()).toBe(DEFAULT_APP_TIMEZONE);
    process.env.APP_TIMEZONE = "Pas/UnFuseau";
    expect(getAppTimeZone()).toBe(DEFAULT_APP_TIMEZONE);
    process.env.APP_TIMEZONE = "  ";
    expect(getAppTimeZone()).toBe(DEFAULT_APP_TIMEZONE);
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone("Africa/Porto-Novo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Nope/Nope")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("exams/time — décalage et calendrier local", () => {
  it("Porto-Novo est à UTC+1 (pas de DST)", () => {
    expect(timeZoneOffsetMs(new Date("2026-01-15T00:00:00Z"), TZ)).toBe(3_600_000);
    expect(timeZoneOffsetMs(new Date("2026-07-15T00:00:00Z"), TZ)).toBe(3_600_000);
  });

  it("le décalage dépend du fuseau demandé, pas de la machine", () => {
    forEachMachineTz(() => {
      const d = new Date("2026-09-25T23:30:00Z");
      expect(timeZoneOffsetMs(d, "UTC")).toBe(0);
      expect(timeZoneOffsetMs(d, TZ)).toBe(3_600_000);
      // 2026-09-25T23:30Z = 00:30 le 26/09 à Tokyo (+9) → jour calendaire J+1
      expect(localDayKey(d, "Asia/Tokyo")).toBe("2026-09-26");
    });
  });

  it("localDateTimeString / localDayKey : 23:30Z = 00:30 le lendemain à Porto-Novo", () => {
    forEachMachineTz(() => {
      const d = new Date("2026-09-25T23:30:00Z");
      expect(localDateTimeString(d, TZ)).toBe("2026-09-26T00:30:00");
      expect(localDayKey(d, TZ)).toBe("2026-09-26");
    });
  });
});

describe("exams/time — minuit local (jour J)", () => {
  it("minuit Porto-Novo = 23:00Z de la veille", () => {
    forEachMachineTz(() => {
      const start = startOfLocalDay("2026-09-25T08:00:00Z", TZ);
      expect(start.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    });
  });

  it("le minuit local est stable pour tout instant du même jour", () => {
    forEachMachineTz(() => {
      const a = startOfLocalDay("2026-09-25T00:00:00Z", TZ); // 01:00 locale J
      const b = startOfLocalDay("2026-09-25T22:59:59Z", TZ); // 23:59 locale J
      expect(a.toISOString()).toBe("2026-09-24T23:00:00.000Z");
      expect(b.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    });
  });

  it("23:30Z du 25/09 appartient déjà au jour 26 (J+1 franchi)", () => {
    forEachMachineTz(() => {
      const late = new Date("2026-09-25T23:30:00Z");
      expect(startOfLocalDay(late, TZ).toISOString()).toBe(
        "2026-09-25T23:00:00.000Z",
      );
    });
  });

  it("un fuseau sans DST (UTC) donne minuit UTC", () => {
    forEachMachineTz(() => {
      expect(startOfLocalDay("2026-09-25T08:00:00Z", "UTC").toISOString()).toBe(
        "2026-09-25T00:00:00.000Z",
      );
    });
  });

  it("accepte Date, string ISO et timestamp", () => {
    const expected = "2026-09-24T23:00:00.000Z";
    expect(startOfLocalDay(new Date("2026-09-25T08:00:00Z"), TZ).toISOString()).toBe(expected);
    expect(startOfLocalDay("2026-09-25T08:00:00Z", TZ).toISOString()).toBe(expected);
    expect(startOfLocalDay(Date.parse("2026-09-25T08:00:00Z"), TZ).toISOString()).toBe(expected);
  });
});

describe("exams/time — resolveOpensOn (repli des examens existants)", () => {
  it("opensOn explicite est ramené au minuit de son jour local", () => {
    forEachMachineTz(() => {
      const opensOn = resolveOpensOn(
        { opensOn: new Date("2026-09-25T08:00:00Z"), scheduledAt: new Date("2026-09-25T08:00:00Z") },
        TZ,
      );
      expect(opensOn?.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    });
  });

  it("repli : opensOn null → jour local de scheduledAt", () => {
    forEachMachineTz(() => {
      const opensOn = resolveOpensOn(
        { opensOn: null, scheduledAt: new Date("2026-09-25T08:00:00Z") },
        TZ,
      );
      expect(opensOn?.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    });
  });

  it("repli : le jour local dépend du fuseau, pas de l'horodatage brut", () => {
    forEachMachineTz(() => {
      const at = new Date("2026-09-25T23:30:00Z");
      expect(resolveOpensOn({ opensOn: null, scheduledAt: at }, TZ)?.toISOString()).toBe(
        "2026-09-25T23:00:00.000Z",
      );
      expect(resolveOpensOn({ opensOn: null, scheduledAt: at }, "UTC")?.toISOString()).toBe(
        "2026-09-25T00:00:00.000Z",
      );
    });
  });

  it("sans opensOn ni scheduledAt → pas d'ouverture", () => {
    expect(resolveOpensOn({}, TZ)).toBeNull();
    expect(resolveOpensOn({ opensOn: null, scheduledAt: null }, TZ)).toBeNull();
    expect(resolveOpensOn({ opensOn: new Date("nope") }, TZ)).toBeNull();
  });

  it("utilise APP_TIMEZONE par défaut", () => {
    process.env.APP_TIMEZONE = "Africa/Porto-Novo";
    expect(resolveOpensOn({ scheduledAt: new Date("2026-09-25T08:00:00Z") })?.toISOString()).toBe(
      "2026-09-24T23:00:00.000Z",
    );
  });
});

describe("exams/time — isSameLocalDay", () => {
  it("même jour calendaire local, fuseaux machine indifférents", () => {
    forEachMachineTz(() => {
      expect(
        isSameLocalDay("2026-09-25T08:00:00Z", "2026-09-25T20:00:00Z", TZ),
      ).toBe(true);
      expect(
        isSameLocalDay("2026-09-25T08:00:00Z", "2026-09-26T08:00:00Z", TZ),
      ).toBe(false);
    });
  });
});
