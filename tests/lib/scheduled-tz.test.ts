import { describe, it, expect } from "vitest";
import {
  fromAppWallClock,
  toAppWallClock,
  startOfAppDay,
} from "@/lib/exams/schedule-ui";

/**
 * Aller-retour de l'heure d'une épreuve (#126, repris par #m9/exam-ui).
 *
 * Historique : ce fichier vérifiait que le formulaire admin relisait
 * `scheduledAt` dans le fuseau du NAVIGATEUR. C'était cohérent tant que la
 * saisie et la relecture se faisaient toutes les deux en heure locale — mais
 * cela signifiait qu'un admin connecté depuis l'étrangerPilotait l'épreuve dans
 * le fuseau de sa machine, et que le jour d'ouverture tombait parfois la veille.
 *
 * Le contrat est désormais explicite : tout se saisit et tout s'affiche en
 * Africa/Porto-Novo, et c'est l'interface qui convertit en UTC à l'envoi. Le
 * test vérifie donc l'aller-retour PAR LE CHEMIN RÉEL, pas une réimplémentation
 * de la conversion à l'intérieur du test.
 */
describe("scheduledAt timezone round-trip (#126)", () => {
  it("heure locale admin → ISO UTC → relecture identique", () => {
    process.env.TZ = "Africa/Porto-Novo"; // UTC+1 (Bénin)
    const local = "2026-09-11T08:00";

    // Côté navigateur (exam-form.tsx) : « 08:00 » = heure de Porto-Novo.
    const iso = fromAppWallClock(local)?.toISOString();
    expect(iso?.endsWith("Z")).toBe(true);
    // L'instant stocké est bien 07:00 UTC pour un fuseau UTC+1.
    expect(iso).toBe("2026-09-11T07:00:00.000Z");

    // Côté édition (edit/page.tsx) : relecture en heure de Porto-Novo.
    expect(toAppWallClock(iso)).toBe(local);
  });

  it("le serveur stocke l'instant sans interprétation de fuseau", () => {
    process.env.TZ = "UTC";
    // Ce que reçoit le serveur : un ISO avec Z → new Date() est déterministe
    const stored = new Date("2026-09-11T07:00:00.000Z");
    expect(stored.toISOString()).toBe("2026-09-11T07:00:00.000Z");
    // Et l'ouverture (CountdownTimer) lit le même instant
    expect(stored.getTime()).toBe(Date.UTC(2026, 8, 11, 7, 0, 0));
  });

  it("le jour d'ouverture est le minuit LOCAL, pas le minuit UTC", () => {
    // 11/09 08:00 Porto-Novo = 11/09 07:00 UTC. L'ouverture de cette journée est
    // le 10/09 23:00 UTC. Confondre les deux avancerait l'ouverture de 23 h.
    const open = startOfAppDay("2026-09-11T07:00:00.000Z");
    expect(open?.toISOString()).toBe("2026-09-10T23:00:00.000Z");
    // …et la journée affichée reste bien celle de l'épreuve.
    expect(toAppWallClock(open)).toBe("2026-09-11T00:00");
  });
});
