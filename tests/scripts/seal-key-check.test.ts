// Tests du diagnostic local de clé de scellement (#155).
// Aucune valeur de clé réelle n'est utilisée : uniquement des valeurs fictives.
import { describe, it, expect } from "vitest";
import { computeSealFingerprint } from "@/lib/crypto/seal";
import {
  analyzeEnvFile,
  findDivergence,
  parseDotenv,
} from "../../scripts/seal-key-check";

describe("scripts/seal-key-check (#155)", () => {
  it("parse les variables .env (guillemets, commentaires, export)", () => {
    const vars = parseDotenv(
      [
        "# commentaire ignoré",
        'CERT_SEAL_SECRET="une-valeur-de-test-0123456789"',
        "CERT_SEAL_FINGERPRINT='abcdef123456'",
        "export AUTRE=ok",
        "LIGNE_INVALIDE",
      ].join("\n"),
    );
    expect(vars.CERT_SEAL_SECRET).toBe("une-valeur-de-test-0123456789");
    expect(vars.CERT_SEAL_FINGERPRINT).toBe("abcdef123456");
    expect(vars.AUTRE).toBe("ok");
    expect(vars.LIGNE_INVALIDE).toBeUndefined();
  });

  it("analyzeEnvFile : fichier introuvable et clé absente / trop courte", () => {
    const missing = analyzeEnvFile(".env.absent", null);
    expect(missing.present).toBe(false);
    expect(missing.fingerprint).toBeNull();
    expect(missing.problem).toContain("introuvable");

    const absent = analyzeEnvFile(".env.x", "AUTRE=1");
    expect(absent.present).toBe(false);
    expect(absent.fingerprint).toBeNull();
    expect(absent.problem).toContain("absent");

    const short = analyzeEnvFile(".env.x", 'CERT_SEAL_SECRET="court"');
    expect(short.present).toBe(false);
    expect(short.problem).toContain("trop court");
  });

  it("analyzeEnvFile : rotation détectée quand l'empreinte épinglée diffère", () => {
    const secret = "script-test-secret-0123456789abcdef";
    const expected = computeSealFingerprint(secret);

    const ok = analyzeEnvFile(
      ".env.local",
      `CERT_SEAL_SECRET=${secret}\nCERT_SEAL_FINGERPRINT=${expected}`,
    );
    expect(ok.present).toBe(true);
    expect(ok.fingerprint).toBe(expected);
    expect(ok.matches).toBe(true);
    expect(ok.rotation).toBe(false);
    expect(ok.problem).toBeNull();

    const rotated = analyzeEnvFile(
      ".env.local",
      `CERT_SEAL_SECRET=${secret}\nCERT_SEAL_FINGERPRINT=deadbeef1234`,
    );
    expect(rotated.rotation).toBe(true);
    expect(rotated.matches).toBe(false);
    expect(rotated.problem).toContain("rotation");
    expect(rotated.fingerprint).toBe(expected);
  });

  it("findDivergence : deux empreintes différentes signalées sans les clés", () => {
    const local = analyzeEnvFile(
      ".env.local",
      "CERT_SEAL_SECRET=aaaaaaaaaaaaaaaaaaaa",
    );
    const prod = analyzeEnvFile(
      ".env.production",
      "CERT_SEAL_SECRET=bbbbbbbbbbbbbbbbbbbb",
    );
    const divergences = findDivergence([local, prod]);
    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toContain("divergence");
    const rendered = divergences.join(" ");
    expect(rendered).not.toContain("aaaaaaaaaaaaaaaaaaaa");
    expect(rendered).not.toContain("bbbbbbbbbbbbbbbbbbbb");
  });

  it("findDivergence : aucune alerte si les empreintes sont identiques", () => {
    const same = "script-test-secret-0123456789abcdef";
    const a = analyzeEnvFile(".env.local", `CERT_SEAL_SECRET=${same}`);
    const b = analyzeEnvFile(".env.production", `CERT_SEAL_SECRET=${same}`);
    expect(findDivergence([a, b])).toEqual([]);
  });
});
