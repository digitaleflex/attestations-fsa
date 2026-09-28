// lib/storage/keys.ts
// #260 — Taxonomie des clés d'objets et durée de vie des URL signées.
//
// Règles :
//   * préfixes disjoints par usage (`cv/`, `stages/`, `attestations/`,
//     `exports/`, `temporary/`) ;
//   * une clé est stable et persistée en base — jamais une URL signée ;
//   * les PDF officiels vivent sous `attestations/` et ne sont jamais
//     supprimables ;
//   * les URL de lecture sont courtes (60 s par défaut, 300 s au maximum).

import { nanoid } from "nanoid";
import { safeExtension, type AllowedMimeType } from "./validation";
import { assertSafeKey } from "./types";

export const STORAGE_PURPOSES = [
  "cv",
  "internship",
  "attestation",
  "export",
  "temporary",
] as const;

export type StoragePurpose = (typeof STORAGE_PURPOSES)[number];

/** Préfixe physique, un par usage. Aucun préfixe partagé entre usages. */
export const PURPOSE_PREFIX: Readonly<Record<StoragePurpose, string>> = {
  cv: "cv",
  internship: "stages",
  attestation: "attestations",
  export: "exports",
  temporary: "temporary",
};

const PREFIX_TO_PURPOSE = new Map<string, StoragePurpose>(
  STORAGE_PURPOSES.map((purpose) => [PURPOSE_PREFIX[purpose], purpose]),
);

/** Durées de vie des URL signées : 60 s par défaut, 300 s au maximum. */
export const DEFAULT_READ_URL_TTL_SECONDS = 60;
export const MAX_READ_URL_TTL_SECONDS = 300;

/** Usages dont les objets sont des pièces probantes : suppression interdite. */
export const IMMUTABLE_PURPOSES: ReadonlySet<StoragePurpose> = new Set<StoragePurpose>([
  "attestation",
]);

export function isStoragePurpose(value: unknown): value is StoragePurpose {
  return typeof value === "string" && (STORAGE_PURPOSES as readonly string[]).includes(value);
}

/**
 * Borne une durée d'URL signée : valeurs invalides → défaut, valeurs
 * excessives → plafond. Empêche la réapparition d'URL signées longue durée.
 */
export function normalizeReadUrlTtl(seconds?: number | null): number {
  if (seconds == null || !Number.isFinite(seconds)) return DEFAULT_READ_URL_TTL_SECONDS;
  const value = Math.floor(seconds);
  if (value <= 0) return DEFAULT_READ_URL_TTL_SECONDS;
  return Math.min(value, MAX_READ_URL_TTL_SECONDS);
}

/** Le préfixe correspond-il à l'usage demandé ? (détecte les collisions de préfixe) */
export function keyPrefixForPurpose(purpose: StoragePurpose): string {
  return PURPOSE_PREFIX[purpose];
}

/**
 * Construit une clé logique stable : `<prefixe>/<id><extension canonique>`.
 * L'extension provient du type MIME détecté, jamais du nom fourni par le client.
 */
export function buildObjectKey(
  mime: AllowedMimeType,
  purpose: StoragePurpose = "cv",
  id: string = nanoid(12)
): string {
  if (!isStoragePurpose(purpose)) throw new Error(`Usage de stockage inconnu: "${purpose}"`);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) throw new Error(`Identifiant d'objet invalide: "${id}"`);
  return assertSafeKey(`${PURPOSE_PREFIX[purpose]}/${id}${safeExtension(mime)}`);
}

/** Usage déduit du préfixe d'une clé, ou null si le préfixe est inconnu. */
export function purposeFromKey(key: string): StoragePurpose | null {
  const prefix = key.split("/")[0];
  return prefix ? (PREFIX_TO_PURPOSE.get(prefix) ?? null) : null;
}

/** Clé de PDF officiel : préfixe `attestations/` (pièce probante immuable). */
export function isOfficialObjectKey(key: string): boolean {
  return PURPOSE_PREFIX.attestation === key.split("/")[0];
}

/** Une URL signée ne doit jamais être persistée en base (#260). */
export function looksLikeSignedUrl(value: string): boolean {
  return /(?:X-Amz-|Signature=|token=|Expires=)/i.test(value);
}
