// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AdminNotificationsListener from "@/components/admin/AdminNotificationsListener";

afterEach(() => cleanup());

describe("AdminNotificationsListener", () => {
  it("se rend sans erreur et ne produit aucun nœud", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container).toBeEmptyDOMElement();
  });
});
