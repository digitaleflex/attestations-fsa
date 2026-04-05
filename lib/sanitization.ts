import { z } from 'zod';

/**
 * S'assure que DOMPurify n'est utilisé que s'il est disponible au niveau du client
 * ou d'une manière légère pour le serveur.
 * Pour la sanitization stricte (sans tags), une simple REGEX suffit et est BEAUCOUP plus rapide sur Vercel.
 */
export function sanitizeInput(input: string): string {
  if (!input) return ''

  // Vérifier que c'est bien une chaîne
  if (typeof input !== 'string') {
    return String(input)
  }

  // Sanitisation légère sans JSDOM pour Vercel (Performance & Stabilité)
  // Supprime tous les tags HTML complets : <tag>...</tag> ou <tag/>
  return input
    .replace(/<[^>]*>?/gm, '') // Supprimer les tags HTML
    .trim();
}

/**
 * Sanitise un objet récursivement
 * @param obj - Objet à sanitiser
 * @returns Objet sanitizé
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeInput(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : item
      )
    } else {
      sanitized[key] = value
    }
  }

  return sanitized as Partial<T>
}

/**
 * Champs critiques qui nécessitent une sanitization renforcée
 */
export const CRITICAL_FIELDS = [
  'message',
  'reason',
  'fullName',
  'observations',
  'comments',
  'description',
  'content',
  'body',
  'title',
  'name',
] as const

/**
 * Middleware de sanitization pour Zod
 * Transforme les données après validation
 */
export function createSanitizedSchema<T extends z.ZodType>(schema: T) {
  return schema.transform((data: unknown) => {
    if (typeof data === 'string') {
      return sanitizeInput(data)
    }
    if (typeof data === 'object' && data !== null) {
      return sanitizeObject(data as Record<string, unknown>)
    }
    return data
  })
}

/**
 * Sanitize un champ spécifique d'un objet
 * @param data - Objet contenant le champ
 * @param field - Nom du champ à sanitiser
 * @returns Objet avec le champ sanitizé
 */
export function sanitizeField<T extends Record<string, unknown>>(
  data: T,
  field: keyof T
): T {
  if (typeof data[field] === 'string') {
    return {
      ...data,
      [field]: sanitizeInput(data[field] as string),
    }
  }
  return data
}

/**
 * Nettoie une entrée HTML en gardant certains tags autorisés
 * @param html - HTML à nettoyer
 * @param allowedTags - Tags HTML autorisés
 * @returns HTML nettoyé
 */
export function sanitizeHTML(
  html: string,
  allowedTags: string[] = ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li']
): string {
  if (!html) return ''

  // Version légère pour Vercel : Stripper de tags sauf ceux autorisés
  const regex = new RegExp(`<(?!\\/?(${allowedTags.join('|')})\\b)[^>]+>`, 'gi');
  return html.replace(regex, '');
}

/**
 * Vérifie si une chaîne contient du code HTML potentiellement dangereux
 * @param input - Chaîne à vérifier
 * @returns true si du code HTML/JS suspect est détecté
 */
export function containsDangerousHTML(input: string): boolean {
  if (!input) return false

  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick=, onerror=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i,
  ]

  return dangerousPatterns.some(pattern => pattern.test(input))
}

/**
 * Encode une chaîne pour une utilisation sûre dans différents contextes
 */
export const HTMLEncode = {
  // Pour utilisation dans du HTML
  forHTML: (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  },

  // Pour utilisation dans un attribut HTML
  forAttribute: (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/=/g, '&#x3D;')
  },

  // Pour utilisation dans du JavaScript
  forJS: (str: string): string => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\x27')
      .replace(/"/g, '\\x22')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/</g, '\\x3C')
      .replace(/>/g, '\\x3E')
  },

  // Pour utilisation dans une URL
  forURL: (str: string): string => {
    return encodeURIComponent(str)
  },
}

/**
 * Nettoie un nom de fichier pour éviter les injections de chemin
 * @param filename - Nom de fichier à nettoyer
 * @returns Nom de fichier sécurisé
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return ''

  // Supprimer les caractères spéciaux et les chemins
  return filename
    .replace(/[^\w.-]/g, '_')
    .replace(/\.{2,}/g, '_')  // .. → _
    .replace(/^\.+/, '')  // Supprimer les points au début
    .substring(0, 255)  // Limiter la longueur
}
