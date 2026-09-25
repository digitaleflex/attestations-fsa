// lib/storage/index.ts
// Factory de stockage objet. Sélection par variables d'environnement :
//   STORAGE_DRIVER=auto (défaut) | s3 | local
//   - auto : S3 si S3_BUCKET est défini, sinon local
//   - local : interdit en production sauf opt-in volume persistant
//             (STORAGE_ALLOW_LOCAL_IN_PRODUCTION=true + STORAGE_LOCAL_DIR hors public/)

import { resolve, join, sep } from "path";
import { LocalStorageDriver } from "./local-driver";
import { S3StorageDriver } from "./s3-driver";
import { StorageConfigError, type StorageDriver } from "./types";
import { resolveSubdirectory, safeExtension } from "./validation";
import { normalizeReadUrlTtl } from "./keys";

export { StorageConfigError } from "./types";
export type { StorageDriver, SignedUrlOptions } from "./types";
export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  detectMimeType,
  resolveSubdirectory,
  safeExtension,
  validateUpload,
} from "./validation";
export type { AllowedMimeType, FileValidationResult } from "./validation";
export {
  DEFAULT_READ_URL_TTL_SECONDS,
  IMMUTABLE_PURPOSES,
  MAX_READ_URL_TTL_SECONDS,
  PURPOSE_PREFIX,
  STORAGE_PURPOSES,
  buildObjectKey,
  isOfficialObjectKey,
  isStoragePurpose,
  keyPrefixForPurpose,
  looksLikeSignedUrl,
  normalizeReadUrlTtl,
  purposeFromKey,
} from "./keys";
export type { StoragePurpose } from "./keys";

export type NodeProcessEnv = Record<string, string | undefined>;

function parseForcePathStyle(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function createLocalDriver(env: NodeProcessEnv): StorageDriver {
  const isProduction = env.NODE_ENV === "production";
  const localDir = env.STORAGE_LOCAL_DIR;

  if (isProduction) {
    if (env.STORAGE_ALLOW_LOCAL_IN_PRODUCTION !== "true") {
      throw new StorageConfigError(
        "Stockage local interdit en production : configurez S3_BUCKET (S3/R2/MinIO) " +
          "ou optez explicitement pour un volume persistant via " +
          "STORAGE_ALLOW_LOCAL_IN_PRODUCTION=true + STORAGE_LOCAL_DIR."
      );
    }
    if (!localDir) {
      throw new StorageConfigError(
        "STORAGE_LOCAL_DIR est requis pour le stockage local en production."
      );
    }
    const resolvedLocal = resolve(localDir);
    const publicDir = resolve(process.cwd(), "public");
    if (resolvedLocal === publicDir || resolvedLocal.startsWith(publicDir + sep)) {
      throw new StorageConfigError(
        "STORAGE_LOCAL_DIR ne doit pas être situé dans public/ en production " +
          "(les fichiers seraient perdus au redéploiement)."
      );
    }
  }

  return new LocalStorageDriver({
    rootDir: localDir,
    publicPrefix: env.STORAGE_PUBLIC_PREFIX,
  });
}

/**
 * Crée le driver de stockage à partir de l'environnement.
 * @throws StorageConfigError si la configuration demandée est invalide.
 */
export function createStorage(env: NodeProcessEnv = process.env): StorageDriver {
  const requested = (env.STORAGE_DRIVER ?? "auto").toLowerCase();
  if (requested !== "auto" && requested !== "s3" && requested !== "local") {
    throw new StorageConfigError(
      `STORAGE_DRIVER invalide: "${env.STORAGE_DRIVER}" (attendu: auto | s3 | local)`
    );
  }

  const s3Configured = Boolean(env.S3_BUCKET);
  const useS3 = requested === "s3" || (requested === "auto" && s3Configured);

  if (requested === "s3" && !s3Configured) {
    throw new StorageConfigError("STORAGE_DRIVER=s3 requiert S3_BUCKET.");
  }

  if (useS3) {
    const ttl = Number.parseInt(env.STORAGE_SIGNED_URL_TTL_SECONDS ?? "", 10);
    return new S3StorageDriver({
      bucket: env.S3_BUCKET as string,
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: parseForcePathStyle(env.S3_FORCE_PATH_STYLE),
      publicBaseUrl: env.S3_PUBLIC_BASE_URL,
      // Bucket privé : durée d'URL signée courte et bornée (60 s, max 300 s).
      signedUrlTtlSeconds: normalizeReadUrlTtl(Number.isFinite(ttl) ? ttl : undefined),
    });
  }

  return createLocalDriver(env);
}

let cachedStorage: StorageDriver | null = null;

/** Driver partagé (mémoïsé) pour les routes Next.js. */
export function getStorage(): StorageDriver {
  if (!cachedStorage) {
    cachedStorage = createStorage();
  }
  return cachedStorage;
}

/** Réinitialise le cache — utilisé par les tests. */
export function resetStorage(): void {
  cachedStorage = null;
}
