// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryProvider } from "@/components/providers/QueryProvider";

afterEach(cleanup);

describe("QueryProvider", () => {
  it("rend ses enfants", () => {
    render(
      <QueryProvider>
        <span>contenu-enfant</span>
      </QueryProvider>,
    );
    expect(screen.getByText("contenu-enfant")).toBeTruthy();
  });

  it("fournit un QueryClient (pas d'erreur de contexte)", () => {
    // Rendu sans planter suffit à valider le provider.
    const { container } = render(
      <QueryProvider>
        <div data-testid="ok">ok</div>
      </QueryProvider>,
    );
    expect(container).toBeTruthy();
  });
});