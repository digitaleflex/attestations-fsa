import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getPermissionsForRole,
  PERMISSIONS,
  Role,
} from "@/lib/permissions";

describe("permissions", () => {
  it("admin a toutes les permissions", () => {
    const perms = getPermissionsForRole("admin");
    expect(perms).toHaveLength(PERMISSIONS.length);
    for (const p of PERMISSIONS) {
      expect(perms).toContain(p);
    }
  });

  it("user n'a aucune permission", () => {
    expect(getPermissionsForRole("user")).toEqual([]);
  });

  it("hasPermission(admin, 'users:read') → true", () => {
    expect(hasPermission("admin", "users:read")).toBe(true);
  });

  it("hasPermission(user, 'users:read') → false", () => {
    expect(hasPermission("user", "users:read")).toBe(false);
  });

  it("hasPermission accepte un objet avec role", () => {
    expect(hasPermission({ role: "admin" }, "users:read")).toBe(true);
    expect(hasPermission({ role: "user" }, "users:read")).toBe(false);
  });

  it("role null/inconnu → aucune permission", () => {
    expect(getPermissionsForRole(null)).toEqual([]);
    expect(getPermissionsForRole("unknown")).toEqual([]);
    expect(hasPermission(null, "users:read")).toBe(false);
  });
});
