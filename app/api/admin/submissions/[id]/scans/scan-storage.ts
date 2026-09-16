// app/api/admin/submissions/[id]/scans/scan-storage.ts
// Dérivation des clés d'objet de stockage pour les scans de composition.
//
// Historiquement les fichiers vivaient dans
// `private/uploads/scans/<submissionId>/<scanId><ext>` ; la clé logique
// reprend exactement cette arborescence (`scans/<submissionId>/<fichier>`),
// ce qui permet de reprendre les objets via `lib/storage/migrate.ts` sans
// changer les références métier.
//
// La logique anti-traversée de l'ancien `resolveScanFilePath` (chemin absolu
// confiné) est remplacée par une validation de segments : une clé d'objet
// n'est jamais un chemin, mais la normalisation défensive est conservée.

/** Anciennes URL pointant vers le filesystem (`/secure-files/scans/<fichier>`). */
const LEGACY_SCAN_URL_PREFIX = '/secure-files/scans/'

/** Extensions autorisées pour les scans physiques (whitelist d'upload). */
const SCAN_EXTENSIONS = ['.pdf', '.jpg', '.png'] as const

const MIME_BY_SCAN_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
}

/** Rejette tout segment de clé vide, relatif ou porteur de séparateurs. */
function isSafeSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== '.' &&
    segment !== '..' &&
    !segment.includes('/') &&
    !segment.includes('\\')
  )
}

/**
 * Extrait l'extension autorisée d'un nom de fichier (fallback `.pdf`).
 * @param originalName - Nom original du fichier
 */
export function scanFileExtension(originalName: string): string {
  const ext = '.' + (originalName.split('.').pop() || '').toLowerCase()
  return (SCAN_EXTENSIONS as readonly string[]).includes(ext) ? ext : '.pdf'
}

/**
 * Nom physique déterministe `${scanId}${ext}` : aucune colonne dédiée en base
 * n'est nécessaire pour retrouver l'objet.
 * @param submissionId - Id de la soumission (ExamSession)
 * @param scanId - Id du CompositionScan (UUID)
 * @param originalName - Nom original (pour l'extension)
 */
export function buildScanObjectKey(
  submissionId: string,
  scanId: string,
  originalName: string,
): string {
  return `scans/${submissionId}/${scanId}${scanFileExtension(originalName)}`
}

/**
 * Clé d'objet d'un scan déjà en base, y compris les anciennes URL
 * `/secure-files/scans/...` (compatibilité descendante).
 * @returns Clé logique sûre, ou null si un segment est invalide.
 */
export function resolveScanObjectKey(
  submissionId: string,
  scan: { id: string; url: string; fileName: string },
): string | null {
  const storedName = scan.url.startsWith(LEGACY_SCAN_URL_PREFIX)
    ? scan.url.slice(scan.url.lastIndexOf('/') + 1)
    : `${scan.id}${scanFileExtension(scan.fileName)}`

  if (!isSafeSegment(submissionId) || !isSafeSegment(storedName)) {
    return null
  }

  return `scans/${submissionId}/${storedName}`
}

/**
 * Type MIME d'un scan déduit de l'extension de sa clé.
 * @param key - Clé logique (ex. `scans/<sub>/<id>.pdf`)
 */
export function contentTypeForScanKey(key: string): string {
  const ext = '.' + (key.split('.').pop() || '').toLowerCase()
  return MIME_BY_SCAN_EXTENSION[ext] || 'application/octet-stream'
}
