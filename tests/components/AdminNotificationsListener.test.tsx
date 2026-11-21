// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/hooks/use-admin-notifications", () => ({
  default: vi.fn(),
  useAdminNotifications: vi.fn(),
}));

import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("ne rend rien (null)", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.firstChild).toBeNull();
  });
});
