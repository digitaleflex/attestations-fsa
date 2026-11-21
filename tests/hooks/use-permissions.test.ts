// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { useSession } from "@/lib/auth-client";
import { usePermissions, useHasPermission } from "@/hooks/use-permissions";

const mockUseSession = useSession as ReturnType<typeof vi.fn>;

function renderWithSession(sessionData: unknown) {
  mockUseSession.mockReturnValue({ data: sessionData });
  let captured: ReturnType<typeof usePermissions> | undefined;
  function Comp() {
    captured = usePermissions();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Comp));
  });
  const result = captured!;
  act(() => {
    root.unmount();
  });
  container.remove();
  return result;
}

describe("usePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne le rôle admin et toutes les permissions", () => {
    const res = renderWithSession({ user: { role: "admin" } });
    expect(res.role).toBe("admin");
    expect(res.permissions.length).toBeGreaterThan(0);
    expect(res.hasPermission("users:read")).toBe(true);
    expect(res.can("users:read")).toBe(true);
  });

  it("retourne le rôle user sans permissions", () => {
    const res = renderWithSession({ user: { role: "user" } });
    expect(res.role).toBe("user");
    expect(res.permissions).toEqual([]);
    expect(res.hasPermission("users:read")).toBe(false);
  });

  it("utilise 'user' par défaut sans session", () => {
    const res = renderWithSession(undefined);
    expect(res.role).toBe("user");
    expect(res.hasPermission("users:read")).toBe(false);
  });

  it("useHasPermission reflète la session", () => {
    mockUseSession.mockReturnValue({ data: { user: { role: "admin" } } });
    let value: boolean | undefined;
    function Comp() {
      value = useHasPermission("users:read");
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(React.createElement(Comp));
    });
    expect(value).toBe(true);
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
