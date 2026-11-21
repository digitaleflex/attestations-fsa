// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom/vitest";
import AdminNotificationsListener from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("se rend sans erreur et ne produit aucun DOM", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container).toBeEmptyDOMElement();
  });
});
