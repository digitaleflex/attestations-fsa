// lib/storage/registry.ts
// #260 — Registre des objets stockés : propriété, finalité, empreinte.
//
// Règles de sécurité appliquées ici (source unique de vérité) :
//   * une lecture ou une suppression exige la propriété de l'objet
//     (`ownerUserId`) ou un rôle administrateur ;
//   * les PDF officiels (`purpose = attestation` ou préfixe `attestations/`)
//     ne sont jamais supprimables ;
//   * seules des clés stables sont enregistrées : aucune URL signée n'est
//     persistée ;
//   * l'écriture est idempotente sur `key` (rejeu d'un upload identique).

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  IMMUTABLE_PURPOSES,
  isOfficialObjectKey,
  isStoragePurpose,
  looksLikeSignedUrl,
  purposeFromKey,
  type StoragePurpose,
} from "./keys";
import { assertSafeKey } from "./types";

export type StoredObjectRecord = {
  id: string;
  key: string;
  ownerUserId: string | null;
  purpose: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  checksum: string;
  sizeBytes: number | null;
  contentType: string | null;
  retentionUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface RegisterStoredObjectInput {
  key: string;
  ownerUserId?: string | null;
  purpose: StoragePurpose;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  checksum: string;
  sizeBytes?: number | null;
  contentType?: string | null;
  retentionUntil?: Date | null;
}

/** Erreurs métier du registre, mappées par les routes API. */
export class StorageOwnershipError extends Error {
  readonly status = 403;
  constructor(message = "Cet objet ne vous appartient pas.") {
    super(message);
    this.name = "StorageOwnershipError";
  }
}

export class StoredObjectNotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Objet introuvable.") {
    super(message);
    this.name = "StoredObjectNotFoundError";
  }
}

export class StoredObjectProtectedError extends Error {
  readonly status = 409;
  constructor(message = "Ce document est une pièce officielle : sa suppression est interdite.") {
    super(message);
    this.name = "StoredObjectProtectedError";
  }
}

export class StorageValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

/** Empreinte SHA-256 hexadécimale du contenu binaire. */
export function computeChecksum(body: Buffer | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Refuse toute valeur qui ressemble à une URL signée : seules les clés sont stockées. */
export function assertStorableKey(key: string): string {
  const safe = assertSafeKey(key);
  if (safe.includes("://") || looksLikeSignedUrl(safe)) {
    throw new StorageValidationError("Seule une clé de stockage stable peut être enregistrée.");
  }
  if (!purposeFromKey(safe)) {
    throw new StorageValidationError(`Clé hors des préfixes autorisés: "${key}"`);
  }
  return safe;
}

export function isOfficialStoredObject(object: {
  purpose: string;
  key: string;
}): boolean {
  return (
    isOfficialObjectKey(object.key) ||
    (isStoragePurpose(object.purpose) && IMMUTABLE_PURPOSES.has(object.purpose))
  );
}

/** La suppression est interdite pour tout objet officiel ou attesté. */
export function assertPurgeAllowed(object: { purpose: string; key: string }): void {
  if (isOfficialStoredObject(object)) throw new StoredObjectProtectedError();
}

/**
 * Vérifie la propriété : propriétaire déclaré, ou objet sans propriétaire
 * (ex. candidature publique) réservé aux administrateurs.
 */
export function assertOwnership(
  object: { ownerUserId: string | null },
  actor: { userId: string | null; isAdmin: boolean }
): void {
  if (actor.isAdmin) return;
  if (!actor.userId) throw new StorageOwnershipError("Authentification requise.");
  if (!object.ownerUserId) {
    throw new StorageOwnershipError("Objet non rattaché à un compte : réservé aux administrateurs.");
  }
  if (object.ownerUserId !== actor.userId) throw new StorageOwnershipError();
}

/**
 * Charge un objet enregistré et vérifie la propriété.
 * @throws StoredObjectNotFoundError / StorageOwnershipError
 */
export async function requireOwnedObject(
  key: string,
  actor: { userId: string | null; isAdmin: boolean }
): Promise<StoredObjectRecord> {
  const safe = assertStorableKey(key);
  const object = (await prisma.storedObject.findUnique({
    where: { key: safe },
  })) as StoredObjectRecord | null;
  if (!object) throw new StoredObjectNotFoundError();
  assertOwnership(object, actor);
  return object;
}

/**
 * Enregistre (ou met à jour) un objet stocké — idempotent sur `key`.
 * Refuse toute clé hors préfixes autorisés et toute URL signée.
 */
export async function registerStoredObject(
  input: RegisterStoredObjectInput
): Promise<StoredObjectRecord> {
  const key = assertStorableKey(input.key);
  if (!isStoragePurpose(input.purpose)) {
    throw new StorageValidationError(`Usage de stockage inconnu: "${input.purpose}"`);
  }
  if (!/^[0-9a-f]{64}$/.test(input.checksum)) {
    throw new StorageValidationError("Empreinte de contenu absente ou non conforme.");
  }
  return (await prisma.storedObject.upsert({
    where: { key },
    create: {
      key,
      ownerUserId: input.ownerUserId ?? null,
      purpose: input.purpose,
      linkedEntityType: input.linkedEntityType ?? null,
      linkedEntityId: input.linkedEntityId ?? null,
      checksum: input.checksum,
      sizeBytes: input.sizeBytes ?? null,
      contentType: input.contentType ?? null,
      retentionUntil: input.retentionUntil ?? null,
    },
    update: {
      ownerUserId: input.ownerUserId ?? null,
      purpose: input.purpose,
      linkedEntityType: input.linkedEntityType ?? null,
      linkedEntityId: input.linkedEntityId ?? null,
      checksum: input.checksum,
      sizeBytes: input.sizeBytes ?? null,
      contentType: input.contentType ?? null,
      retentionUntil: input.retentionUntil ?? null,
    },
  })) as StoredObjectRecord;
}

/** Retire l'objet du registre après suppression effective côté stockage. */
export async function unregisterStoredObject(key: string): Promise<void> {
  const safe = assertStorableKey(key);
  await prisma.storedObject.deleteMany({ where: { key: safe } });
}
