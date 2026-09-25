import { describe, it, expect } from "vitest";
import { buildObjectKey, createStorage, resetStorage, getStorage } from "./index";
import { S3StorageDriver } from "./s3-driver";
import { LocalStorageDriver } from "./local-driver";
import { StorageConfigError } from "./types";

describe("buildObjectKey", () => {
  it("génère une clé préfixée par usage avec extension canonique", () => {
    expect(buildObjectKey("application/pdf", "cv", "abc123")).toBe("cv/abc123.pdf");
    expect(buildObjectKey("image/webp", "cv", "xyz123")).toBe("cv/xyz123.webp");
  });

  it("sépare les usages par préfixe dédié", () => {
    expect(buildObjectKey("application/pdf", "internship", "abc123")).toBe("stages/abc123.pdf");
    expect(buildObjectKey("application/pdf", "attestation", "abc123")).toBe("attestations/abc123.pdf");
    expect(buildObjectKey("application/pdf", "export", "abc123")).toBe("exports/abc123.pdf");
    expect(buildObjectKey("image/png", "temporary", "abc123")).toBe("temporary/abc123.png");
  });
});

describe("createStorage", () => {
  it("choisit le local en auto sans S3_BUCKET", () => {
    const driver = createStorage({ NODE_ENV: "development" });
    expect(driver).toBeInstanceOf(LocalStorageDriver);
  });

  it("choisit S3 en auto si S3_BUCKET est défini", () => {
    const driver = createStorage({ NODE_ENV: "development", S3_BUCKET: "bucket" });
    expect(driver).toBeInstanceOf(S3StorageDriver);
  });

  it("refuse le local en production (garde anti public/uploads)", () => {
    expect(() => createStorage({ NODE_ENV: "production" })).toThrow(StorageConfigError);
  });

  it("refuse un STORAGE_LOCAL_DIR dans public/ en production", () => {
    expect(() =>
      createStorage({
        NODE_ENV: "production",
        STORAGE_ALLOW_LOCAL_IN_PRODUCTION: "true",
        STORAGE_LOCAL_DIR: "public/uploads",
      })
    ).toThrow(StorageConfigError);
  });

  it("accepte un volume persistant hors public/ en production", () => {
    const driver = createStorage({
      NODE_ENV: "production",
      STORAGE_ALLOW_LOCAL_IN_PRODUCTION: "true",
      STORAGE_LOCAL_DIR: "/var/lib/fsa/uploads",
    });
    expect(driver).toBeInstanceOf(LocalStorageDriver);
  });

  it("rejette un STORAGE_DRIVER inconnu", () => {
    expect(() => createStorage({ STORAGE_DRIVER: "ftp" })).toThrow(StorageConfigError);
  });
});

describe("getStorage", () => {
  it("mémoïse le driver et se réinitialise", () => {
    resetStorage();
    const first = getStorage();
    const second = getStorage();
    expect(first).toBe(second);
    resetStorage();
    expect(getStorage()).not.toBe(first);
  });
});
