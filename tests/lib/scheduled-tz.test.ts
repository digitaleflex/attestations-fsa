import { describe, it, expect } from "vitest";

// #126 — Fuseau horaire de scheduledAt.
// Invariant : le navigateur convertit "YYYY-MM-DDTHH:mm" (heure locale admin)
// en ISO UTC avant envoi ; le serveur stocke l'instant ; la relecture
// (édition) retrouve la même heure locale, quel que soit le fuseau du serveur.
describe("scheduledAt timezone round-trip (#126)", () => {
  it("heure locale → ISO UTC → relecture locale identique (UTC+1)", () => {
    process.env.TZ = "Africa/Porto-Novo"; // UTC+1 (Bénin)
    const local = "2026-09-11T08:00";

    // Côté navigateur (exam-form.tsx) : new Date(local) = 08:00 heure locale
    const iso = new Date(local).toISOString();
    expect(iso.endsWith("Z")).toBe(true);
    // L'instant stocké est bien 07:00 UTC pour un fuseau UTC+1
    expect(iso).toBe("2026-09-11T07:00:00.000Z");

    // Côté édition (edit/page.tsx) : relecture en heure locale
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const back = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(back).toBe(local);
  });

  it("le serveur stocke l'instant sans interprétation de fuseau", () => {
    process.env.TZ = "UTC";
    // Ce que reçoit le serveur : un ISO avec Z → new Date() est déterministe
    const stored = new Date("2026-09-11T07:00:00.000Z");
    expect(stored.toISOString()).toBe("2026-09-11T07:00:00.000Z");
    // Et l'ouverture (CountdownTimer) lit le même instant
    expect(stored.getTime()).toBe(Date.UTC(2026, 8, 11, 7, 0, 0));
  });
});
