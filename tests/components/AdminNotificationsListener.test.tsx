// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import AdminNotificationsListener from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("rend null (aucun markup)", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container).toBeEmptyDOMElement();
  });
});
