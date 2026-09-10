import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getAdminUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { requireAdmin, requireUser, assertAdminRole } from "@/lib/api-auth";
import { isPlausibleSessionToken } from "@/middleware";
import { getAdminUser, getCurrentUser } from "@/lib/auth";

const mockGetAdminUser = getAdminUser as ReturnType<typeof vi.fn>;
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

function makeRequest(): Request {
  return { headers: new Headers() } as Request;
}

describe("isPlausibleSessionToken - garde-fou Edge", () => {
  it("rejette les valeurs vides ou trop courtes", () => {
    expect(isPlausibleSessionToken(null)).toBe(false);
    expect(isPlausibleSessionToken(undefined)).toBe(false);
    expect(isPlausibleSessionToken("")).toBe(false);
    expect(isPlausibleSessionToken("   ")).toBe(false);
    expect(isPlausibleSessionToken("abc")).toBe(false);
    expect(isPlausibleSessionToken("null")).toBe(false);
    expect(isPlausibleSessionToken("undefined")).toBe(false);
  });

  it("accepte un token de session plausible", () => {
    expect(isPlausibleSessionToken("a1b2c3d4e5f6g7h8i9j0")).toBe(true);
  });
});

describe("requireAdmin - vérifie réellement la session", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne user quand la session admin est valide", async () => {
    mockGetAdminUser.mockResolvedValue({
      id: "1",
      email: "a@b.c",
      role: "admin",
    });
    const result = await requireAdmin(makeRequest());
    expect("user" in result).toBe(true);
  });

  it("retourne 401 quand pas admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const result = await requireAdmin(makeRequest());
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
    }
  });
});

describe("requireUser - vérifie réellement la session", () => {
  it("retourne user quand authentifié", async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: "1",
      email: "u@b.c",
      role: "USER",
    });
    const result = await requireUser(makeRequest());
    expect("user" in result).toBe(true);
  });

  it("retourne 401 sans session", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await requireUser(makeRequest());
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
    }
  });
});

describe("assertAdminRole", () => {
  it("retourne null pour admin (insensible à la casse)", () => {
    expect(assertAdminRole({ role: "ADMIN" })).toBeNull();
    expect(assertAdminRole({ role: "admin" })).toBeNull();
  });

  it("retourne 403 pour non-admin", () => {
    const res = assertAdminRole({ role: "USER" });
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("retourne 403 sans user", () => {
    expect(assertAdminRole(null)?.status).toBe(403);
  });
});
