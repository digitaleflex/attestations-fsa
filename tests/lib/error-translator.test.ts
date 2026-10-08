import { describe, it, expect } from "vitest";
import { translateAuthError } from "@/lib/error-translator";

/**
 * `lib/error-translator.ts` (issue #11) : chaque branche de traduction,
 * l'insensibilité à la casse, et le repli (fallback).
 */
describe("translateAuthError - Better Auth", () => {
  it("traduit les identifiants invalides", () => {
    expect(translateAuthError("Invalid email or password")).toBe(
      "Email ou mot de passe incorrect.",
    );
  });

  it("traduit le compte introuvable", () => {
    expect(translateAuthError("User not found")).toBe("Compte introuvable.");
  });

  it("traduit l'email non vérifié", () => {
    expect(translateAuthError("Email not verified")).toBe(
      "Votre adresse email n'est pas encore vérifiée.",
    );
  });

  it("traduit la session expirée", () => {
    expect(translateAuthError("Session expired, please sign in again")).toBe(
      "Votre session a expiré. Veuillez vous reconnecter.",
    );
  });

  it("traduit les refus d'accès (forbidden / unauthorized)", () => {
    const attendu =
      "Accès refusé. Vous n'avez pas les permissions nécessaires.";
    expect(translateAuthError("Forbidden")).toBe(attendu);
    expect(translateAuthError("Unauthorized")).toBe(attendu);
  });

  it("traduit le dépassement de quota", () => {
    expect(translateAuthError("Rate limit exceeded, try again later")).toBe(
      "Trop de tentatives. Veuillez patienter un moment.",
    );
  });

  it("traduit les erreurs réseau", () => {
    const attendu = "Erreur réseau. Vérifiez votre connexion.";
    expect(translateAuthError("Failed to fetch")).toBe(attendu);
    expect(translateAuthError("Network Error")).toBe(attendu);
  });

  it("traduit les erreurs de sécurité de session", () => {
    const attendu =
      "Erreur de sécurité de session. Veuillez recharger la page.";
    expect(translateAuthError("CRSF token mismatch")).toBe(attendu);
    expect(translateAuthError("Invalid original URL")).toBe(attendu);
  });
});

describe("translateAuthError - Zod & validation", () => {
  it("traduit les champs obligatoires", () => {
    expect(translateAuthError("Email is required")).toBe(
      "Ce champ est obligatoire.",
    );
  });

  it("traduit les emails invalides", () => {
    expect(translateAuthError("Invalid email address")).toBe(
      "Veuillez entrer une adresse email valide.",
    );
  });

  it("traduit les contenus trop courts", () => {
    expect(translateAuthError("Password is too short")).toBe(
      "Le contenu est trop court.",
    );
  });
});

describe("translateAuthError - repli et casse", () => {
  it("est insensible à la casse", () => {
    expect(translateAuthError("INVALID EMAIL OR PASSWORD")).toBe(
      "Email ou mot de passe incorrect.",
    );
  });

  it("détecte le motif au milieu d'un message plus long", () => {
    expect(
      translateAuthError("Sign-in failed: user not found in database"),
    ).toBe("Compte introuvable.");
  });

  it("renvoie le message d'origine quand aucun motif ne correspond", () => {
    expect(translateAuthError("Quelque chose d'inattendu")).toBe(
      "Quelque chose d'inattendu",
    );
  });

  it("renvoie le message générique pour un message vide", () => {
    expect(translateAuthError("")).toBe(
      "Une erreur est survenue lors de l'opération.",
    );
  });
});
