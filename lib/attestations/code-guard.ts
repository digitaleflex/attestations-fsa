/**
 * Garde applicative d'immuabilité du code FSA (#255).
 *
 * `Attestation.code` est FIGÉ : il est imprimé sur un document officiel, cité
 * par le QR public et vérifiable par un tiers. Aucune voie applicative ne doit
 * le réécrire. Ce module fournit :
 *  - la reconnaissance du code FSA (format unique, aligné sur l'inventaire) ;
 *  - un garde de mutation refusant toute mise à jour qui toucherait `code` ;
 *  - la traduction de l'erreur PostgreSQL du trigger en erreur métier.
 *
 * La défense en profondeur est ensured par le trigger SQL
 * `20260927_attestation_code_immutability` : ce garde évite l'erreur en amont,
 * le trigger la rend impossible même en SQL direct.
 *
 * Module PUR : aucun accès base, aucune écriture.
 */
import { REFERENCE_CODE_PATTERN } from "./reference-export";

export const ATTESTATION_CODE_PATTERN = REFERENCE_CODE_PATTERN;

/** Message de refus, volontairement sans valeur : aucun code n'est rejoué. */
export const CODE_IMMUTABLE_MESSAGE =
  "Attestation.code est immuable : un code FSA existant ne peut être ni modifié, ni régénéré, ni supprimé.";

export class AttestationCodeImmutableError extends Error {
  readonly code = "ATTESTATION_CODE_IMMUTABLE";
  constructor(detail = CODE_IMMUTABLE_MESSAGE) {
    super(detail);
    this.name = "AttestationCodeImmutableError";
  }
}

export function isFsaCode(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = ATTESTATION_CODE_PATTERN.exec(value);
  if (!match) return false;
  // Le motif accepte `M00`..`M99` : le mois doit être un mois, et la séquence
  // un entier positif — sinon le code n'est pas un code FSA valide.
  const month = Number(match[2]);
  const sequence = Number(match[3]);
  const year = Number(match[1]);
  return month >= 1 && month <= 12 && sequence >= 1 && year >= 2000;
}

/**
 * Vérifie qu'une mise à jour d'attestation ne touche pas `code`.
 * Absent = inchangé (cas nominal) ; identique = autorisé (aucun-op) ;
 * différent = refus.
 */
export function assertCodeUnchanged(before: { code: string } | null | undefined, mutation: { code?: unknown } | null | undefined): void {
  if (!mutation || !("code" in mutation)) return;
  if (mutation.code === undefined) return;
  if (before && mutation.code === before.code) return;
  throw new AttestationCodeImmutableError();
}

/**
 * Variante stricte pour les chemins d'écriture : retire `code` des données
 * soumises et échoue si la valeur fournie diffère de l'existant.
 */
export function withImmutableCode<T extends Record<string, unknown>>(
  before: { code: string } | null | undefined,
  data: T,
): Omit<T, "code"> {
  assertCodeUnchanged(before, data as { code?: unknown });
  const { code, ...rest } = data as T & { code?: unknown };
  void code;
  return rest as Omit<T, "code">;
}

/** Le trigger PostgreSQL remonte `P0001` avec un message dédié. */
const TRIGGER_SIGNATURE = /immuab/i;

export function isAttestationCodeImmutableError(error: unknown): boolean {
  if (error instanceof AttestationCodeImmutableError) return true;
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return TRIGGER_SIGNATURE.test(message);
}
