// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

import AdminNotificationsListener from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("renders nothing", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.firstChild).toBeNull();
  });
});