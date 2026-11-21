// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

vi.mock("pusher-js", () => ({
  default: vi.fn(() => ({
    subscribe: vi.fn(() => ({
      bind_global: vi.fn(),
      unbind_all: vi.fn(),
      unbind_global: vi.fn(),
    })),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("se rend sans rien afficher", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.firstChild).toBeNull();
  });
});
