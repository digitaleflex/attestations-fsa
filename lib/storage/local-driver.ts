// lib/storage/local-driver.ts
// Driver fichiers local — réservé au développement (ou à un volume persistant
// explicitement monté hors de `public/`). En production, la factory
// `lib/storage/index.ts` refuse d'écrire dans `public/uploads`.

import { mkdir, writeFile, unlink, access } from "fs/promises";
import { constants } from "fs";
import { dirname, join, resolve, sep } from "path";
import { assertSafeKey, type StorageDriver } from "./types";

export interface LocalStorageDriverOptions {
  /** Répertoire racine d'écriture. Défaut : `<cwd>/public/uploads`. */
  rootDir?: string;
  /** Préfixe d'URL publique. Défaut : `/uploads`. */
  publicPrefix?: string;
}

export class LocalStorageDriver implements StorageDriver {
  private readonly rootDir: string;
  private readonly publicPrefix: string;

  constructor(options: LocalStorageDriverOptions = {}) {
    this.rootDir = resolve(options.rootDir ?? join(process.cwd(), "public", "uploads"));
    this.publicPrefix = options.publicPrefix ?? "/uploads";
  }

  /** Chemin absolu confiné au répertoire racine (anti path-traversal). */
  private resolveKey(key: string): string {
    const safeKey = assertSafeKey(key);
    const fullPath = resolve(this.rootDir, safeKey);
    if (fullPath !== this.rootDir && !fullPath.startsWith(this.rootDir + sep)) {
      throw new Error(`Clé hors du répertoire de stockage: "${key}"`);
    }
    return fullPath;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const fullPath = this.resolveKey(key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, body);
  }

  async getSignedUrl(key: string): Promise<string> {
    return `${this.publicPrefix}/${assertSafeKey(key)}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveKey(key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
