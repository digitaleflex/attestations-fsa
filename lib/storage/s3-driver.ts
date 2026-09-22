// lib/storage/s3-driver.ts
// Driver S3-compatible : Cloudflare R2, AWS S3, MinIO, Scaleway…
// Utilise @aws-sdk/client-s3 via import dynamique : le SDK n'est chargé que
// lorsque ce driver est effectivement sélectionné (le dev local reste léger).

import type { S3Client } from "@aws-sdk/client-s3";
import { StorageConfigError, assertSafeKey, type StorageDriver } from "./types";

export interface S3StorageDriverOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Requis par MinIO / certains S3-compatibles (bucket dans le path). */
  forcePathStyle?: boolean;
  /**
   * Si défini, `getSignedUrl` retourne `<publicBaseUrl>/<key>` (bucket
   * public-read) au lieu d'une URL signée expirante. À réserver aux objets
   * réellement publics (logos), jamais aux CV/scans nominatifs.
   */
  publicBaseUrl?: string;
  /** Durée de vie des URL signées. Défaut : 7 jours. */
  signedUrlTtlSeconds?: number;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

export class S3StorageDriver implements StorageDriver {
  private readonly options: S3StorageDriverOptions;
  private clientPromise: Promise<S3Client> | null = null;

  constructor(options: S3StorageDriverOptions) {
    if (!options.bucket) throw new StorageConfigError("S3_BUCKET est requis pour le driver S3");
    this.options = options;
  }

  private getClient(): Promise<S3Client> {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(
        ({ S3Client }) =>
          new S3Client({
            region: this.options.region,
            endpoint: this.options.endpoint,
            forcePathStyle: this.options.forcePathStyle,
            credentials:
              this.options.accessKeyId && this.options.secretAccessKey
                ? {
                    accessKeyId: this.options.accessKeyId,
                    secretAccessKey: this.options.secretAccessKey,
                  }
                : undefined,
          })
      );
    }
    return this.clientPromise;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: assertSafeKey(key),
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const safeKey = assertSafeKey(key);
    if (this.options.publicBaseUrl) {
      const base = this.options.publicBaseUrl.replace(/\/+$/, "");
      return `${base}/${safeKey}`;
    }
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: safeKey }),
      {
        expiresIn:
          expiresInSeconds ?? this.options.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS,
      }
    );
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.options.bucket, Key: assertSafeKey(key) })
    );
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key: assertSafeKey(key) })
      );
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return false;
      throw error;
    }
  }
}
