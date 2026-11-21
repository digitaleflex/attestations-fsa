// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("@/hooks/use-admin-notifications", () => ({
  useAdminNotifications: vi.fn(),
  default: vi.fn(),
}));

import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

describe("AdminNotificationsListener", () => {
  it("renders nothing", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.innerHTML).toBe("");
  });

  it("calls useAdminNotifications on mount", () => {
    render(<AdminNotificationsListener />);
    expect(useAdminNotifications).toHaveBeenCalled();
  });
});
