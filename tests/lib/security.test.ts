import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyOrigin } from "@/lib/security";

function makeRequest(opts: {
  url?: string;
  host?: string;
  origin?: string | null;
}) {
  const headers = new Headers();
  if (opts.host) headers.set("host", opts.host);
  if (opts.origin) headers.set("origin", opts.origin);
  return new Request(opts.url ?? "http://localhost:3000/api/x", { headers });
}

describe("verifyOrigin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepte une origin valide (même host)", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/x",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    });
    expect(verifyOrigin(req)).toBe(true);
  });

  it("rejette une origin invalide (host différent)", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/x",
      host: "localhost:3000",
      origin: "http://evil.com",
    });
    expect(verifyOrigin(req)).toBe(false);
  });

  it("autorise l'absence d'Origin header", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/x",
      host: "localhost:3000",
    });
    expect(verifyOrigin(req)).toBe(true);
  });

  it("compare l'hôte (le protocole n'est pas vérifié par l'implémentation)", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/x",
      host: "localhost:3000",
      origin: "https://localhost:3000",
    });
    // L'implémentation actuelle ne compare que l'hôte.
    expect(verifyOrigin(req)).toBe(true);
  });
});
