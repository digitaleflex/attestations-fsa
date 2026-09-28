import { describe, it, expect } from "vitest";
import {
  DEFAULT_READ_URL_TTL_SECONDS,
  IMMUTABLE_PURPOSES,
  MAX_READ_URL_TTL_SECONDS,
  PURPOSE_PREFIX,
  STORAGE_PURPOSES,
  buildObjectKey,
  isOfficialObjectKey,
  isStoragePurpose,
  looksLikeSignedUrl,
  normalizeReadUrlTtl,
  purposeFromKey,
} from "./keys";

describe("préfixes de stockage (#260)", () => {
  it("déclare un préfixe disjoint par usage", () => {
    const prefixes = STORAGE_PURPOSES.map((purpose) => PURPOSE_PREFIX[purpose]);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(prefixes).toEqual(["cv", "stages", "attestations", "exports", "temporary"]);
  });

  it("construit une clé stable sous le bon préfixe", () => {
    expect(buildObjectKey("application/pdf", "cv", "abcdefghijkl")).toBe("cv/abcdefghijkl.pdf");
    expect(buildObjectKey("application/pdf", "internship", "abcdefghijkl")).toBe(
      "stages/abcdefghijkl.pdf",
    );
    expect(buildObjectKey("image/png", "export", "abcdefghijkl")).toBe("exports/abcdefghijkl.png");
    expect(buildObjectKey("image/webp", "temporary", "abcdefghijkl")).toBe(
      "temporary/abcdefghijkl.webp",
    );
  });

  it("rejette un usage inconnu et un identifiant d'objet douteux", () => {
    expect(() => buildObjectKey("application/pdf", "admin" as never, "abcdefghijkl")).toThrow(
      /Usage de stockage inconnu/,
    );
    expect(() => buildObjectKey("application/pdf", "cv", "../escape")).toThrow();
    expect(() => buildObjectKey("application/pdf", "cv", "a/b")).toThrow();
  });

  it("déduit l'usage et la nature officielle d'une clé", () => {
    expect(purposeFromKey("cv/abcdefghijkl.pdf")).toBe("cv");
    expect(purposeFromKey("stages/abcdefghijkl.pdf")).toBe("internship");
    expect(purposeFromKey("attestations/FSA-2026-M09-00001-abcde/v1.pdf")).toBe("attestation");
    expect(purposeFromKey("legacy/images/x.pdf")).toBeNull();
    expect(isOfficialObjectKey("attestations/FSA-2026/v1.pdf")).toBe(true);
    expect(isOfficialObjectKey("cv/abcdefghijkl.pdf")).toBe(false);
  });

  it("marque les usages immuables", () => {
    expect(IMMUTABLE_PURPOSES.has("attestation")).toBe(true);
    expect(IMMUTABLE_PURPOSES.has("cv")).toBe(false);
    expect(isStoragePurpose("cv")).toBe(true);
    expect(isStoragePurpose("images")).toBe(false);
  });
});

describe("durée de vie des URL signées (#260)", () => {
  it("utilise 60 s par défaut", () => {
    expect(DEFAULT_READ_URL_TTL_SECONDS).toBe(60);
    expect(normalizeReadUrlTtl(undefined)).toBe(60);
    expect(normalizeReadUrlTtl(null)).toBe(60);
    expect(normalizeReadUrlTtl(Number.NaN)).toBe(60);
    expect(normalizeReadUrlTtl(0)).toBe(60);
    expect(normalizeReadUrlTtl(-10)).toBe(60);
  });

  it("borne la durée à 300 s", () => {
    expect(MAX_READ_URL_TTL_SECONDS).toBe(300);
    expect(normalizeReadUrlTtl(30)).toBe(30);
    expect(normalizeReadUrlTtl(600)).toBe(300);
    expect(normalizeReadUrlTtl(7 * 24 * 60 * 60)).toBe(300);
  });

  it("détecte les URL signées à ne jamais persister", () => {
    expect(
      looksLikeSignedUrl("https://bucket.r2.cloudflarestorage.com/cv/a.pdf?X-Amz-Signature=abc"),
    ).toBe(true);
    expect(looksLikeSignedUrl("https://cdn.test/cv/a.pdf?token=abc")).toBe(true);
    expect(looksLikeSignedUrl("https://cdn.test/cv/a.pdf?Expires=1&Signature=b")).toBe(true);
    expect(looksLikeSignedUrl("cv/abcdefghijkl.pdf")).toBe(false);
  });
});
