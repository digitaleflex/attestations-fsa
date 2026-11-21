// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("se rend et affiche ses enfants", () => {
    const { container } = render(
      <QueryProvider>
        <span>contenu enfant</span>
      </QueryProvider>,
    );
    expect(container.textContent).toContain("contenu enfant");
  });

  it("fournit un client de requête sans erreur", () => {
    const { container } = render(
      <QueryProvider>
        <div data-testid="ok">ok</div>
      </QueryProvider>,
    );
    expect(container.querySelector('[data-testid="ok"]')).not.toBeNull();
  });
});
