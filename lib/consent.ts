/**
 * Registre des consentements — #153 (RGPD art. 7 / APDP Bénin)
 *
 * ## Pourquoi une table et pas un simple cookie ou une case à cocher
 *
 * Le RGPD impose de pouvoir prouver qu'une personne a consenti (« le
 * responsable du traitement doit être en mesure de démontrer le
 * consentement »). Une case à cocher dans un formulaire ne le prouve pas :
 * elle ne dit ni quand, ni depuis quelle version des CGU, ni depuis quelle IP.
 *
 * Donc : une ligne par couple (utilisateur, type), horodatée et versionnée.
 *
 * ## Règle de non-destruction
 *
 * Une révocation ne SUPPRIME JAMAIS la ligne. Elle passe `granted = false`
 * et renseigne `revokedAt`. Supprimer la ligne détruirait la preuve même du
 * retrait du consentement — c'est-à-dire exactement ce qu'on doit pouvoir
 * prouver. L'historique reste append-only.
 *
 * ## Ce qui est révocable
 *
 * Seul `MARKETING` est réellement révocable par la personne : les autres
 * reposent sur l'exécution du contrat ou une obligation légale, dont le
 * retrait n'a pas à être possible au sens du droit. Le code refuse donc
 * de « révoquer » `TERMS`, `PRIVACY`, `DATA_PROCESSING` et
 * `THIRD_PARTY_TRANSFER` : ce sont des acceptations de conditions, leur
 * retrait passe par l'effacement du compte (#291), qui est la voie prévue
 * par la loi.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  CONSENT_TYPES,
  CURRENT_DOCUMENT_VERSION,
  isConsentType,
  isRevocable,
  REQUIRED_CONSENTS,
  type ConsentTypeName,
} from "@/lib/consent-types";

/**
 * Les constantes vivent dans `lib/consent-types.ts`, sans dépendance runtime,
 * pour être importables par le formulaire d'inscription (composant client).
 * Réexportées ici afin que les appelants serveur n'aient qu'un seul point
 * d'entrée.
 */
export {
  CONSENT_TYPES,
  REQUIRED_CONSENTS,
  REVOCABLE_CONSENTS,
  CURRENT_DOCUMENT_VERSION,
  isConsentType,
  isRevocable,
} from "@/lib/consent-types";
export type { ConsentTypeName } from "@/lib/consent-types";

export class ConsentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentValidationError";
  }
}

/** Contexte de traçabilité, relevé côté requête HTTP. */
export interface ConsentContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  documentVersion?: string;
}

export interface RecordConsentInput extends ConsentContext {
  userId: string;
  type: ConsentTypeName;
  granted: boolean;
}

/**
 * Enregistre un consentement (accord ou refus).
 *
 * Idempotent sur l'état courant : ré-accorder un consentement déjà accordé ne
 * crée pas de doublon, et ré-accorder après un retrait réinitialise
 * proprement `grantedAt` / `revokedAt` sans perdre l'historique des lignes
 * précédentes.
 *
 * @throws ConsentValidationError si le type est inconnu ou si on tente de
 * révoquer un consentement non révocable.
 */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  const { userId, type, granted, ipAddress, userAgent } = input;
  const documentVersion = input.documentVersion ?? CURRENT_DOCUMENT_VERSION;

  if (!isConsentType(type)) {
    throw new ConsentValidationError(`Type de consentement inconnu : ${String(type)}`);
  }

  if (!granted && !isRevocable(type)) {
    throw new ConsentValidationError(
      `Le consentement ${type} ne se révoque pas individuellement : il repose sur ` +
        `l'exécution du contrat ou une obligation légale. Utilisez l'effacement ` +
        `du compte (droit à l'effacement, #291). Seul MARKETING est révocable.`,
    );
  }

  const now = new Date();
  const existing = await prisma.consent.findFirst({
    where: { userId, type },
    orderBy: { grantedAt: "desc" },
  });

  if (existing) {
    // Déjà dans l'état demandé : ne rien écrire. La trace doit refléter des
    // changements réels, pas des clics répétés.
    if (existing.granted === granted) return;

    await prisma.consent.update({
      where: { id: existing.id },
      data: granted
        ? { granted: true, grantedAt: now, revokedAt: null, documentVersion }
        : { granted: false, revokedAt: now },
    });
    return;
  }

  await prisma.consent.create({
    data: {
      userId,
      type,
      granted,
      grantedAt: now,
      revokedAt: granted ? null : now,
      documentVersion,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });
}

/**
 * Enregistre plusieurs consentements en une transaction : un lot est soit
 * entièrement écrit, soit pas du tout. Évite d'enregistrer l'acceptation des
 * CGU sans celle de la politique de confidentialité.
 */
export async function recordConsents(inputs: RecordConsentInput[]): Promise<void> {
  // Validation AVANT toute écriture : on refuse le lot entier plutôt que
  // d'écrire une partie.
  for (const input of inputs) {
    if (!isConsentType(input.type)) {
      throw new ConsentValidationError(`Type de consentement inconnu : ${String(input.type)}`);
    }
    if (!input.granted && !isRevocable(input.type)) {
      throw new ConsentValidationError(
        `Le consentement ${input.type} ne se révoque pas individuellement (voir lib/consent.ts).`,
      );
    }
  }

  await prisma.$transaction(
    inputs.map((input) =>
      prisma.consent.create({
        data: {
          userId: input.userId,
          type: input.type,
          granted: input.granted,
          grantedAt: new Date(),
          revokedAt: input.granted ? null : new Date(),
          documentVersion: input.documentVersion ?? CURRENT_DOCUMENT_VERSION,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      }),
    ),
  );
}

/** État courant des consentements d'un utilisateur, indexé par type. */
export async function getConsentState(userId: string): Promise<Record<string, ConsentState>> {
  const rows = await prisma.consent.findMany({
    where: { userId },
    orderBy: { grantedAt: "desc" },
  });

  const state: Record<string, ConsentState> = {};
  for (const type of CONSENT_TYPES) {
    state[type] = { type, granted: false, required: REQUIRED_CONSENTS.includes(type), revocable: isRevocable(type) };
  }
  // `orderBy grantedAt desc` + première écriture gagne : la ligne la plus
  // récente par type reflète l'état courant.
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.type)) continue;
    seen.add(row.type);
    state[row.type] = {
      type: row.type,
      granted: row.granted,
      grantedAt: row.grantedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      documentVersion: row.documentVersion,
      required: REQUIRED_CONSENTS.includes(row.type as ConsentTypeName),
      revocable: isRevocable(row.type as ConsentTypeName),
    };
  }
  return state;
}

export interface ConsentState {
  type: string;
  granted: boolean;
  required?: boolean;
  revocable?: boolean;
  grantedAt?: string;
  revokedAt?: string | null;
  documentVersion?: string;
}

/**
 * Les acceptations obligatoires sont-elles toutes données ?
 *
 * Sert à vérifier qu'un compte a bien une base légale documentée, et à
 * alerter si un compte ancien (créé avant cette feature) n'en a aucune.
 */
export async function hasRequiredConsents(userId: string): Promise<boolean> {
  const rows = await prisma.consent.findMany({
    where: { userId, type: { in: [...REQUIRED_CONSENTS] }, granted: true },
    select: { type: true },
  });
  const granted = new Set(rows.map((r) => r.type));
  return REQUIRED_CONSENTS.every((t) => granted.has(t));
}

/** Export RGPD : include les consentements dans le dossier de la personne. */
export async function exportConsents(
  userId: string,
): Promise<Prisma.ConsentGetPayload<Record<string, never>>[]> {
  return prisma.consent.findMany({
    where: { userId },
    orderBy: { grantedAt: "desc" },
  });
}