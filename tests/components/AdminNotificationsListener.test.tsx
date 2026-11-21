// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

import AdminNotificationsListener from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("se rend sans rien afficher", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.firstChild).toBeNull();
  });
});
