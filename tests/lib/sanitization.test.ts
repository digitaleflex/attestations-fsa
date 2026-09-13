import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  sanitizeInput,
  sanitizeObject,
  createSanitizedSchema,
  sanitizeField,
  sanitizeHTML,
  containsDangerousHTML,
  HTMLEncode,
  sanitizeFilename,
  CRITICAL_FIELDS,
} from "../../lib/sanitization";

describe("sanitization.sanitizeInput", () => {
  it("supprime les tags HTML", () => {
    expect(sanitizeInput("<script>alert(1)</script>")).toBe("alert(1)");
    expect(sanitizeInput("<b>gras</b>")).toBe("gras");
    expect(sanitizeInput("<img src=x onerror=alert(1)>")).toBe("");
  });

  it("gère les chaînes vides et non-chaînes", () => {
    expect(sanitizeInput("")).toBe("");
    expect(sanitizeInput(null as unknown as string)).toBe("");
    expect(sanitizeInput(42 as unknown as string)).toBe("42");
  });

  it("conserve le texte légitime et trim", () => {
    expect(sanitizeInput("  Bonjour le monde  ")).toBe("Bonjour le monde");
    expect(sanitizeInput("a < b et c > d")).toBe("a  d"); // < b et c > retiré entier
  });
});

describe("sanitization.sanitizeObject", () => {
  it("sanitise récursivement les chaînes", () => {
    const obj = {
      name: "<b>Alice</b>",
      nested: { message: "<script>x</script>" },
      list: ["<i>a</i>", "b"],
      number: 42,
    };
    const result = sanitizeObject(obj);
    expect(result.name).toBe("Alice");
    expect(result.nested).toEqual({ message: "x" });
    expect(result.list).toEqual(["a", "b"]);
    expect(result.number).toBe(42);
  });
});

describe("sanitization.createSanitizedSchema", () => {
  it("sanitise après validation Zod", () => {
    const schema = createSanitizedSchema(z.object({ name: z.string() }));
    const result = schema.parse({ name: "<script>alert(1)</script>" }) as {
      name: string;
    };
    expect(result.name).toBe("alert(1)");
  });
});

describe("sanitization.sanitizeField", () => {
  it("sanitise un champ précis", () => {
    const data = { message: "<b>ok</b>", count: 3 };
    const result = sanitizeField(data, "message");
    expect(result.message).toBe("ok");
    expect(result.count).toBe(3);
  });
});

describe("sanitization.sanitizeHTML", () => {
  it("garde les tags autorisés, retire les autres", () => {
    expect(sanitizeHTML("<b>gras</b><script>x</script>")).toBe("<b>gras</b>x"); // tags retirés, texte conservé
    expect(sanitizeHTML("<p>para</p><iframe src=x></iframe>")).toBe(
      "<p>para</p>",
    );
  });
});

describe("sanitization.containsDangerousHTML", () => {
  it("détecte script/javascript/onerror/iframe", () => {
    expect(containsDangerousHTML("<script>alert(1)</script>")).toBe(true);
    expect(containsDangerousHTML("javascript:alert(1)")).toBe(true);
    expect(containsDangerousHTML('<img onerror="x">')).toBe(true);
    expect(containsDangerousHTML("<iframe src=x></iframe>")).toBe(true);
    expect(containsDangerousHTML("texte normal")).toBe(false);
  });
});

describe("sanitization.HTMLEncode", () => {
  it("encode pour HTML", () => {
    expect(HTMLEncode.forHTML('<a href="x">&')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;",
    );
  });
  it("encode pour attribut (avec =)", () => {
    expect(HTMLEncode.forAttribute('a="b"')).toBe("a&#x3D;&quot;b&quot;");
  });
  it("encode pour JS", () => {
    expect(HTMLEncode.forJS("a'b")).toBe("a\\x27b");
  });
  it("encode pour URL", () => {
    expect(HTMLEncode.forURL("a b")).toBe("a%20b");
  });
});

describe("sanitization.sanitizeFilename", () => {
  it("neutralise les chemins et caractères spéciaux", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("____etc_passwd");
    expect(sanitizeFilename("mon fichier.pdf")).toBe("mon_fichier.pdf");
    expect(sanitizeFilename("..")).toBe("_"); // .. → _
  });
});

describe("sanitization.CRITICAL_FIELDS", () => {
  it("contient les champs sensibles attendus", () => {
    expect(CRITICAL_FIELDS).toContain("message");
    expect(CRITICAL_FIELDS).toContain("fullName");
    expect(CRITICAL_FIELDS).toContain("observations");
  });
});
