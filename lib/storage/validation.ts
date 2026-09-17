// lib/storage/validation.ts
// Validation des fichiers entrants AVANT écriture : taille, type MIME déclaré
// et magic bytes (contenu réel). Source unique de vérité pour l'upload route
// et les scripts de migration.

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Extension canonique imposée par le type MIME détecté (jamais par le nom client). */
const MIME_EXTENSIONS: Record<AllowedMimeType, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Sous-dossier logique dérivé du type MIME (compatibilité des anciennes URLs). */
export function resolveSubdirectory(mime: AllowedMimeType): string {
  if (mime === "application/pdf") return "cv";
  return "images";
}

/**
 * Détecte le type MIME réel à partir des magic bytes.
 * @returns le type MIME autorisé, ou null si non reconnu.
 */
export function detectMimeType(buffer: Buffer): AllowedMimeType | null {
  if (buffer.length >= 4 && buffer.toString("latin1", 0, 4) === "%PDF") {
    return "application/pdf";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("latin1", 0, 4) === "RIFF" &&
    buffer.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type FileValidationResult =
  | { ok: true; mime: AllowedMimeType }
  | { ok: false; error: string };

/**
 * Valide taille, type déclaré et contenu réel.
 * Le type MIME détecté (magic bytes) est la référence : un fichier dont le
 * type déclaré est autorisé mais dont le contenu ne correspond pas est rejeté.
 */
export function validateUpload(
  file: { size: number; type: string; name: string },
  buffer: Buffer
): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)`,
    };
  }
  if (buffer.length === 0) {
    return { ok: false, error: "Fichier vide" };
  }
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)`,
    };
  }

  const detected = detectMimeType(buffer);
  if (!detected) {
    return { ok: false, error: "Type de fichier non autorisé" };
  }
  // `file.type` peut être vide (client capricieux) : le contenu fait foi.
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return { ok: false, error: "Type de fichier non autorisé" };
  }
  if (file.type && file.type !== detected) {
    return {
      ok: false,
      error: "Le contenu du fichier ne correspond pas à son type déclaré",
    };
  }
  return { ok: true, mime: detected };
}

/** Extension canonique sûre associée au type MIME détecté. */
export function safeExtension(mime: AllowedMimeType): string {
  return MIME_EXTENSIONS[mime];
}
