// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("rend ses enfants", () => {
    render(
      <QueryProvider>
        <span>contenu enfant</span>
      </QueryProvider>,
    );
    expect(screen.getByText("contenu enfant")).toBeTruthy();
  });

  it("fournit un QueryClient sans erreur", () => {
    const { container } = render(
      <QueryProvider>
        <div data-testid="child">ok</div>
      </QueryProvider>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });
});
