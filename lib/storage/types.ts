// lib/storage/types.ts
// Contrat commun à tous les drivers de stockage objet.
// Un driver reçoit une clé logique (ex: "cv/ab12cd34.pdf") et ne connaît
// pas les détails des appelants (route upload, scripts de migration).

/** Options de génération d'URL de lecture. */
export interface SignedUrlOptions {
  /**
   * Autorise le retour d'une URL publique stable (`S3_PUBLIC_BASE_URL`)
   * au lieu d'une URL signée. Réservé aux objets réellement publics
   * (logo d'institution) : jamais aux CV, images ou PDF nominatifs.
   */
  allowPublicBaseUrl?: boolean;
}

export interface StorageDriver {
  /**
   * Écrit un objet. Écrase silencieusement un objet de même clé.
   * @param key Clé logique relative (segments séparés par "/", jamais absolue).
   * @param body Contenu binaire.
   * @param contentType Type MIME validé.
   */
  put(key: string, body: Buffer, contentType: string): Promise<void>;

  /**
   * Retourne une URL temporaire d'accès en lecture (URL signée pour S3/R2,
   * chemin du driver local en développement).
   * @param key Clé logique.
   * @param expiresInSeconds Durée de validité, bornée par l'appelant
   *        (`normalizeReadUrlTtl`, 60 s par défaut). Ignorée par le driver local.
   * @param options `allowPublicBaseUrl` n'est honored que pour les objets
   *        explicitement publics (bucket privé par défaut).
   */
  getSignedUrl(
    key: string,
    expiresInSeconds?: number,
    options?: SignedUrlOptions
  ): Promise<string>;

  /** Supprime un objet. Idempotent : ne lève pas si l'objet est absent. */
  delete(key: string): Promise<void>;

  /** Indique si un objet existe. */
  exists(key: string): Promise<boolean>;
}

/** Erreur de configuration du stockage (env manquante ou combinaison interdite). */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

/** Rejette toute clé pouvant permettre une traversée de chemin. */
export function assertSafeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized === ".." ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Clé de stockage invalide: "${key}"`);
  }
  return normalized;
}
