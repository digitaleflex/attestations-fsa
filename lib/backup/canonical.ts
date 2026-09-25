/**
 * Sérialisation canonique et empreintes (#255).
 *
 * Un export ou un manifeste n'est « reproductible » que si deux exécutions sur
 * la même base produisent la même chaîne d'octets. On garantit donc :
 *  - clés d'objet triées (l'ordre d'insertion ne joue plus) ;
 *  - ordre des tableaux laissé à l'appelant (qui trie explicitement ses lignes) ;
 *  - `undefined` omis, comme `JSON.stringify`.
 *
 * Module PUR : aucun accès base, aucun secret, aucune écriture.
 */
import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (source[key] === undefined) continue;
    out[key] = canonicalize(source[key]);
  }
  return out;
}

/** JSON canonique : clés triées, dates ISO, aucun `undefined`. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Empreinte du contenu canonique — indépendant de l'horodatage d'exécution. */
export function digestOf(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}
