// tests/security/trusted-origins.test.ts
// #283 — En production, les trustedOrigins de Better Auth doivent être une
// ALLOWLIST EXACTE issue de la configuration de déploiement. Les jokers
// (`https://*.vercel.app`, `http://192.168.0.*`, …) sont réservés au
// développement : en production ils autorisent n'importe quel sous-domaine
// d'un hébergeur tiers à Piloter des requêtes cross-site authentifiées.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Les mocks doivent être déclarés AVANT l'import de @/lib/auth (rawPrisma +
// next/headers sont importés au chargement du module).
vi.mock("@/lib/prisma", () => ({
  rawPrisma: {},
  prisma: {},
  default: {},
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { parseTrustedOrigin, resolveTrustedOrigins } from "@/lib/auth";

const PROD_ENV = {
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://fsa.eurin.tech",
};

describe("#283 — parseTrustedOrigin", () => {
  it("accepte une origine absolue https", () => {
    expect(parseTrustedOrigin("https://fsa.eurin.tech")).toBe(
      "https://fsa.eurin.tech",
    );
  });

  it("normalise la barre oblique finale et les espaces", () => {
    expect(parseTrustedOrigin("  https://fsa.eurin.tech/  ")).toBe(
      "https://fsa.eurin.tech",
    );
  });

  it("rejette les jokers (wildcards)", () => {
    expect(parseTrustedOrigin("https://*.vercel.app")).toBeNull();
    expect(parseTrustedOrigin("http://192.168.0.*")).toBeNull();
    expect(parseTrustedOrigin("https://*")).toBeNull();
  });

  it("rejette les valeurs non absolues ou invalides", () => {
    expect(parseTrustedOrigin("fsa.eurin.tech")).toBeNull();
    expect(parseTrustedOrigin("")).toBeNull();
    expect(parseTrustedOrigin("javascript:alert(1)")).toBeNull();
  });
});

describe("#283 — resolveTrustedOrigins en production", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("n'expose AUCUN joker dans l'allowlist de production", () => {
    const origins = resolveTrustedOrigins({
      ...PROD_ENV,
      BETTER_AUTH_TRUSTED_ORIGINS: "https://*.vercel.app,https://*.loca.lt",
    });

    expect(origins.some((origin) => origin.includes("*"))).toBe(false);
    expect(origins).not.toContain("https://*.vercel.app");
    expect(origins).not.toContain("https://*.loca.lt");
    expect(origins).toContain("https://fsa.eurin.tech");
  });

  it("ignore les origines de développement (localhost, LAN, tunnels)", () => {
    const origins = resolveTrustedOrigins(PROD_ENV);

    expect(origins).not.toContain("http://localhost:3000");
    expect(origins).not.toContain("http://127.0.0.1:3000");
    expect(origins.every((origin) => !origin.includes("192.168"))).toBe(true);
  });

  it("accepte les origines exactes fournies par le déploiement", () => {
    const origins = resolveTrustedOrigins({
      ...PROD_ENV,
      APP_URL: "https://app.fsa.eurin.tech",
      BETTER_AUTH_TRUSTED_ORIGINS:
        " https://verifier.fsa.eurin.tech , https://fsa.eurin.tech ",
    });

    expect(origins).toContain("https://app.fsa.eurin.tech");
    expect(origins).toContain("https://verifier.fsa.eurin.tech");
    // Dédupliqué malgré les doublons de configuration.
    expect(
      origins.filter((origin) => origin === "https://fsa.eurin.tech"),
    ).toHaveLength(1);
  });

  it("refuse une origine non absolue fournie par le déploiement", () => {
    const origins = resolveTrustedOrigins({
      ...PROD_ENV,
      BETTER_AUTH_TRUSTED_ORIGINS: "fsa.eurin.tech,https://ok.eurin.tech",
    });

    expect(origins).not.toContain("fsa.eurin.tech");
    expect(origins).toContain("https://ok.eurin.tech");
  });

  it("retombe sur l'URL de l'application quand rien n'est configuré", () => {
    expect(resolveTrustedOrigins({ NODE_ENV: "production" })).toContain(
      "https://fsa.eurin.tech",
    );
  });
});

describe("#283 — resolveTrustedOrigins hors production", () => {
  it("conserve localhost, le LAN et les tunnels en développement", () => {
    const origins = resolveTrustedOrigins({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });

    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://127.0.0.1:3000");
    expect(origins).toContain("https://*.vercel.app");
    expect(origins).toContain("http://192.168.1.*");
  });

  it("conserve les jokers en test (NODE_ENV=test)", () => {
    const origins = resolveTrustedOrigins({ NODE_ENV: "test" });

    expect(origins).toContain("https://*.vercel.app");
  });
});
