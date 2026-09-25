import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_READ_URL_TTL_SECONDS,
  buildObjectKey,
  getStorage,
  isStoragePurpose,
  normalizeReadUrlTtl,
  validateUpload,
} from "@/lib/storage";
import { StorageConfigError } from "@/lib/storage/types";
import {
  StorageOwnershipError,
  StoredObjectNotFoundError,
  StoredObjectProtectedError,
  StorageValidationError,
  assertPurgeAllowed,
  computeChecksum,
  registerStoredObject,
  requireOwnedObject,
  unregisterStoredObject,
} from "@/lib/storage/registry";

// Route d'upload privé pour les usages authentifiés.
// Le stockage est délégué à `lib/storage` : objet S3/R2/MinIO en production
// (bucket privé), fichiers locaux en développement. Aucune écriture dans
// `public/uploads` en production (garde appliquée par la factory).
//
// #260 : seule la clé stable est persistée (table `StoredObject`), jamais
// l'URL signée expirante renvoyée au client. La lecture et la suppression
// exigent la propriété de l'objet ; les PDF officiels sont protégés.

/** Usages acceptables pour un envoi utilisateur (jamais `attestation`). */
const UPLOADABLE_PURPOSES = ["cv", "internship", "export", "temporary"] as const;

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function resolvePurpose(raw: string): (typeof UPLOADABLE_PURPOSES)[number] {
  if (!raw) return "cv";
  if (!isStoragePurpose(raw) || raw === "attestation") {
    throw new StorageValidationError(`Usage de stockage refusé: "${raw}"`);
  }
  return raw as (typeof UPLOADABLE_PURPOSES)[number];
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser(request);
    const admin = await getAdminUser(request);
    if (!user && !admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const purpose = resolvePurpose(textField(formData, "purpose"));
    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateUpload(
      { size: file.size, type: file.type, name: file.name },
      bytes
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Idempotence : une clé déjà enregistrée par le même propriétaire renvoie
    // l'objet existant au lieu d'écrire un doublon.
    const replayKey = textField(formData, "key");
    if (replayKey) {
      const existing = await requireOwnedObject(replayKey, {
        userId: user?.id ?? null,
        isAdmin: Boolean(admin),
      });
      const url = await getStorage().getSignedUrl(existing.key, DEFAULT_READ_URL_TTL_SECONDS);
      return NextResponse.json(
        {
          url,
          key: existing.key,
          objectId: existing.id,
          checksum: existing.checksum,
          purpose: existing.purpose,
          expiresIn: DEFAULT_READ_URL_TTL_SECONDS,
          idempotent: true,
        },
        { status: 200 }
      );
    }

    const storage = getStorage();
    const key = buildObjectKey(validation.mime, purpose);
    const checksum = computeChecksum(bytes);
    await storage.put(key, bytes, validation.mime);

    const object = await registerStoredObject({
      key,
      ownerUserId: user?.id ?? null,
      purpose,
      checksum,
      sizeBytes: bytes.length,
      contentType: validation.mime,
      retentionUntil: new Date(Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    });

    // URL courte, jamais persistée : le client la régénère à la demande.
    const ttl = normalizeReadUrlTtl(DEFAULT_READ_URL_TTL_SECONDS);
    const url = await storage.getSignedUrl(key, ttl);

    return NextResponse.json(
      {
        url,
        key,
        objectId: object.id,
        filename: file.name,
        size: file.size,
        type: validation.mime,
        checksum,
        purpose,
        expiresIn: ttl,
        idempotent: false,
      },
      { status: 201 }
    );
  } catch (error) {
    return storageErrorResponse(error, "[UPLOAD_ERROR]", "Erreur lors de l'upload");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const admin = await getAdminUser(request);
    if (!user && !admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Paramètre key requis" }, { status: 400 });
    }

    // Propriété vérifiée avant toute suppression : un objet non enregistré
    // n'est pas supprimable (les PDF officiels et les objets historiques
    // restent intacts).
    const object = await requireOwnedObject(key, {
      userId: user?.id ?? null,
      isAdmin: Boolean(admin),
    });
    // requireOwnedObject a déjà validé la propriété ; le garde de suppression
    // s'applique ensuite, avant tout contact avec le bucket.
    assertPurgeAllowed(object);

    await getStorage().delete(object.key);
    await unregisterStoredObject(object.key);

    return NextResponse.json({ deleted: true, key: object.key });
  } catch (error) {
    return storageErrorResponse(error, "[UPLOAD_DELETE_ERROR]", "Erreur lors de la suppression");
  }
}

const DEFAULT_RETENTION_DAYS = 365;

function storageErrorResponse(error: unknown, logTag: string, message: string) {
  if (error instanceof StorageConfigError) {
    console.error("[UPLOAD_STORAGE_CONFIG_ERROR]", error.message);
    return NextResponse.json({ error: "Stockage des fichiers mal configuré" }, { status: 500 });
  }
  if (error instanceof StoredObjectProtectedError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof StorageOwnershipError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof StoredObjectNotFoundError) {
    return NextResponse.json({ error: "Objet non enregistré ou introuvable" }, { status: 404 });
  }
  if (error instanceof StorageValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error && error.message.startsWith("Clé de stockage invalide")) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
  }
  console.error(logTag, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
