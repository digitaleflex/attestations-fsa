/**
 * Constantes pures du registre des consentements — #153 (RGPD art. 7 / APDP).
 *
 * ## Pourquoi ce fichier existe
 *
 * `lib/consent.ts` importe `prisma` : il ne peut donc pas être importé par un
 * composant client sans embarquer le client base de données dans le bundle
 * navigateur. Or le formulaire d'inscription a besoin des mêmes constantes
 * (`REQUIRED_CONSENTS`, `CONSENT_TYPES`) pour afficher les cases à cocher.
 *
 * Recopier la liste côté UI aurait créé exactement le défaut qu'on vient de
 * corriger sur `DEFAULT_RETENTION_DAYS` : deux définitions d'une même règle,
 * qui divergent silencieusement. Les constantes vivent donc ici, sans aucune
 * dépendance runtime, et `lib/consent.ts` les réexporte.
 *
 * `ConsentType` est importé en `import type` uniquement : l'import est effacé
 * à la compilation, donc rien de Prisma n'entre dans le bundle client.
 */

import type { ConsentType } from "@prisma/client";

/** Types de consentement acceptés par l'API. */
export const CONSENT_TYPES = [
  "TERMS",
  "PRIVACY",
  "DATA_PROCESSING",
  "THIRD_PARTY_TRANSFER",
  "MARKETING",
] as const satisfies readonly ConsentType[];

export type ConsentTypeName = (typeof CONSENT_TYPES)[number];

/**
 * Types exigés pour qu'un compte soit utilisable : sans ces trois
 * acceptations, le traitement n'a pas de base légale documentée.
 */
export const REQUIRED_CONSENTS: readonly ConsentTypeName[] = [
  "TERMS",
  "PRIVACY",
  "DATA_PROCESSING",
];

/** Seuls ceux-ci sont révocables par la personne (voir `lib/consent.ts`). */
export const REVOCABLE_CONSENTS: readonly ConsentTypeName[] = ["MARKETING"];

/** Version courante des documents acceptés. À bumped à chaque révision. */
export const CURRENT_DOCUMENT_VERSION = "2026-01";

export function isConsentType(value: unknown): value is ConsentTypeName {
  return typeof value === "string" && (CONSENT_TYPES as readonly string[]).includes(value);
}

export function isRevocable(type: ConsentTypeName): boolean {
  return REVOCABLE_CONSENTS.includes(type);
}

/** Entrée de consentement telle que l'accepte `POST /api/user/after-signup`. */
export interface RegistrationConsent {
  type: ConsentTypeName;
  granted: true;
}

/**
 * Construit le lot de consentements envoyé à l'inscription (clickwrap).
 *
 * ## Pourquoi ce n'est pas dans le composant
 *
 * `recordConsents` (`lib/consent.ts`) REJETTE le lot entier — 422 — dès qu'un
 * type non révocable arrive avec `granted: false`. Envoyer les cases décochées
 * ferait donc échouer la création de compte, et c'est exactement le genre de
 * régression qu'un test unitaire attrape mieux qu'un test de rendu.
 *
 * Le contrat est volontairement asymétrique :
 * - les trois acceptations contractuelles sont TOUJOURS envoyées (`granted:
 *   true`) : le clic sur « Créer mon compte » en est la preuve ;
 * - `MARKETING` n'est envoyé que s'il a été coché — l'absence de ligne vaut
 *   refus côté `getConsentState`, et n'écrit pas un faux refus horodaté.
 *
 * @param marketingGranted état de la case marketing (décochée par défaut).
 */
export function buildRegistrationConsents(
  marketingGranted: boolean,
): RegistrationConsent[] {
  return [
    ...REQUIRED_CONSENTS.map((type) => ({ type, granted: true as const })),
    ...(marketingGranted
      ? [{ type: "MARKETING" as const, granted: true as const }]
      : []),
  ];
}
