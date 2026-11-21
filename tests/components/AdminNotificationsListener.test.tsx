// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  it("se rend sans erreur et ne produit aucun DOM", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.innerHTML).toBe("");
  });
});