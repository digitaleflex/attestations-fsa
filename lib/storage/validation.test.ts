import { describe, it, expect } from "vitest";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  detectMimeType,
  resolveSubdirectory,
  safeExtension,
  validateUpload,
} from "./validation";

const PDF = Buffer.from("%PDF-1.7\n", "latin1");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1")]);
const TEXT = Buffer.from("hello world", "utf8");

describe("detectMimeType", () => {
  it("détecte les magic bytes des types autorisés", () => {
    expect(detectMimeType(PDF)).toBe("application/pdf");
    expect(detectMimeType(JPEG)).toBe("image/jpeg");
    expect(detectMimeType(PNG)).toBe("image/png");
    expect(detectMimeType(WEBP)).toBe("image/webp");
  });

  it("rejette un contenu non reconnu", () => {
    expect(detectMimeType(TEXT)).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepte un PDF valide", () => {
    const result = validateUpload(
      { size: PDF.length, type: "application/pdf", name: "cv.pdf" },
      PDF
    );
    expect(result).toEqual({ ok: true, mime: "application/pdf" });
  });

  it("accepte un PNG dont le type déclaré est vide (contenu fait foi)", () => {
    const result = validateUpload({ size: PNG.length, type: "", name: "img" }, PNG);
    expect(result).toEqual({ ok: true, mime: "image/png" });
  });

  it("rejette un type déclaré non autorisé", () => {
    const result = validateUpload(
      { size: TEXT.length, type: "text/plain", name: "notes.txt" },
      TEXT
    );
    expect(result.ok).toBe(false);
  });

  it("rejette un contenu ne correspondant pas au type déclaré", () => {
    const result = validateUpload(
      { size: PDF.length, type: "image/png", name: "fake.png" },
      PDF
    );
    expect(result.ok).toBe(false);
  });

  it("rejette un fichier vide", () => {
    const result = validateUpload({ size: 0, type: "application/pdf", name: "v.pdf" }, Buffer.alloc(0));
    expect(result.ok).toBe(false);
  });

  it("rejette un fichier au-delà de la taille maximale", () => {
    const oversized = Buffer.concat([PDF, Buffer.alloc(MAX_FILE_SIZE)]);
    const result = validateUpload(
      { size: oversized.length, type: "application/pdf", name: "big.pdf" },
      oversized
    );
    expect(result.ok).toBe(false);
  });
});

describe("extensions et sous-dossiers", () => {
  it("impose l'extension canonique par type MIME", () => {
    expect(safeExtension("application/pdf")).toBe(".pdf");
    expect(safeExtension("image/jpeg")).toBe(".jpg");
    expect(safeExtension("image/png")).toBe(".png");
    expect(safeExtension("image/webp")).toBe(".webp");
  });

  it("range les PDF dans cv/ et les images dans images/", () => {
    expect(resolveSubdirectory("application/pdf")).toBe("cv");
    expect(resolveSubdirectory("image/png")).toBe("images");
  });

  it("expose 4 types autorisés", () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(4);
  });
});
