// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-admin-notifications", () => ({
  useAdminNotifications: vi.fn(),
  default: vi.fn(),
}));

import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("ne rend rien (null)", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.innerHTML).toBe("");
  });
});
