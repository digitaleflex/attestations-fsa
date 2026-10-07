// tests/config/next-image-remote-patterns.test.ts
// #284 — `images.remotePatterns` acceptait `{protocol:"http|https", hostname:"**"}`
// : n'importe quel hôte, y compris des IP internes (169.254.169.254 — endpoint
// metadata cloud) et des domainesresolver vers un réseau privé. `next/image`
// devient alors un SSRF sortant piloté par une URL stockée en base.
//
// Après : allowlist explicite d'hôtes + HTTPS uniquement (l'insecure est
// réintroduisible hôte par hôte, et seulement en local/dev).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** Sous-ensemble de `next/image` `RemotePattern` utilisé par la config. */
type RemotePattern = {
  protocol?: "http" | "https";
  hostname?: string;
  port?: string;
  pathname?: string;
};

type ImportedConfig = {
  images: { remotePatterns: RemotePattern[]; unoptimized?: boolean };
};

const ALLOWED_ENV = {
  NEXT_IMAGE_REMOTE_HOSTS: "",
  NEXT_IMAGE_REMOTE_HOSTS_INSECURE: "",
  NEXT_PUBLIC_APP_URL: "",
  S3_PUBLIC_BASE_URL: "",
} as Record<string, string | undefined>;

async function loadConfig(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...ALLOWED_ENV, ...env })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // Aucun DSN tiers requis pour lire la config.
  const mod = (await import("../../next.config.mjs")) as { default: ImportedConfig };
  return mod.default;
}

/** Reproduit l'algorithme d'appariement de Next.js (micromatch sur hostname). */
function matches(pattern: RemotePattern, url: string): boolean {
  const target = new URL(url);
  if (pattern.protocol && pattern.protocol !== target.protocol.replace(":", "")) return false;
  if (pattern.port && Number(pattern.port) !== Number(target.port || 443)) return false;
  if (pattern.hostname === "**") return true;
  if (!pattern.hostname) return false;
  // `**` traverse n'importe quel nombre de labels, `*` exactement un label.
  const source = pattern.hostname
    .split("**")
    .map((part) => part.split("*").map(escapeRegExp).join("[^.]*"))
    .join(".*");
  return new RegExp(`^${source}$`, "i").test(target.hostname);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function allowed(patterns: RemotePattern[], url: string): boolean {
  return patterns.some((pattern) => matches(pattern, url));
}

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(
    Object.keys(ALLOWED_ENV).map((key) => [key, process.env[key]]),
  );
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("#284 — allowlist d'hôtes pour next/image", () => {
  it("n'autorise plus aucun hôte arbitraire (pas de hostname '**')", async () => {
    const config = await loadConfig();

    for (const pattern of config.images.remotePatterns) {
      expect(pattern.hostname).not.toBe("**");
      expect(pattern.hostname).toBeTruthy();
    }
  });

  it("sans déclaration, aucune image distante n'est autorisée (fail closed)", async () => {
    const config = await loadConfig();

    expect(config.images.remotePatterns).toEqual([]);
    expect(allowed(config.images.remotePatterns, "https://cdn.example.com/logo.png")).toBe(false);
  });

  it("autorise le domaine de l'application et le bucket de stockage déclarés", async () => {
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: "https://fsa.example.org" });

    expect(allowed(config.images.remotePatterns, "https://fsa.example.org/logo.png")).toBe(true);
    expect(allowed(config.images.remotePatterns, "http://fsa.example.org/logo.png")).toBe(false);
  });

  it("n'autorise que HTTPS par défaut", async () => {
    const config = await loadConfig();

    for (const pattern of config.images.remotePatterns) {
      expect(pattern.protocol).toBe("https");
    }
  });

  it("refuse l'IP metadata cloud (169.254.169.254) et les autres IP", async () => {
    const config = await loadConfig();

    expect(allowed(config.images.remotePatterns, "https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(allowed(config.images.remotePatterns, "http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(allowed(config.images.remotePatterns, "https://10.0.0.1/secret.png")).toBe(false);
    expect(allowed(config.images.remotePatterns, "https://127.0.0.1/x.png")).toBe(false);
    expect(allowed(config.images.remotePatterns, "https://[::1]/x.png")).toBe(false);
    // Et l'astérisque unique ne doit pas laisser passer un sous-domaine piégé.
    expect(allowed(config.images.remotePatterns, "https://169.254.169.254.evil.com/x.png")).toBe(false);
  });

  it("refuse les domaines non déclarés dans l'allowlist", async () => {
    const config = await loadConfig({ NEXT_IMAGE_REMOTE_HOSTS: "cdn.example.com" });

    expect(allowed(config.images.remotePatterns, "https://cdn.example.com/logo.png")).toBe(true);
    expect(allowed(config.images.remotePatterns, "https://evil.com/logo.png")).toBe(false);
    expect(allowed(config.images.remotePatterns, "https://attacker.example.com/logo.png")).toBe(false);
    expect(allowed(config.images.remotePatterns, "https://cdn.example.com.attacker.io/logo.png")).toBe(false);
  });

  it("déduit l'hôte du CDN de stockage déclaré (S3_PUBLIC_BASE_URL)", async () => {
    const config = await loadConfig({ S3_PUBLIC_BASE_URL: "https://files.example.com/media" });

    expect(allowed(config.images.remotePatterns, "https://files.example.com/media/logo.png")).toBe(true);
    // Le port explicite d'une URL locale ne doit pas élargir l'allowlist.
    expect(allowed(config.images.remotePatterns, "https://files.example.com.evil.com/media/logo.png")).toBe(false);
  });

  it("ignore les entrées non valides (chaîne vide, URL sans hôte, IP littérale)", async () => {
    const config = await loadConfig({
      NEXT_IMAGE_REMOTE_HOSTS: "  , ,, not a url, http://, 169.254.169.254 , 10.0.0.5 , cdn.example.com ",
    });

    const hostnames = config.images.remotePatterns.map((p) => p.hostname);
    expect(hostnames).toContain("cdn.example.com");
    expect(hostnames).not.toContain("169.254.169.254");
    expect(hostnames).not.toContain("10.0.0.5");
    expect(hostnames).not.toContain("not a url");
  });

  it("n'expose l'HTTP que pour les hôtes insécures explicitement listés", async () => {
    const config = await loadConfig({
      NEXT_IMAGE_REMOTE_HOSTS_INSECURE: "localhost,minio",
    });

    expect(allowed(config.images.remotePatterns, "http://localhost:3000/logo.png")).toBe(true);
    expect(allowed(config.images.remotePatterns, "http://minio:9000/logo.png")).toBe(true);
    // Le même hôte reste refusé en dehors du mode déclaré…
    expect(allowed(config.images.remotePatterns, "http://cdn.example.com/logo.png")).toBe(false);
    // …et l'insécure ne devient jamais une porte ouverte sur tous les hôtes.
    for (const pattern of config.images.remotePatterns) {
      if (pattern.protocol === "http") expect(pattern.hostname).toBeTruthy();
    }
  });
});
