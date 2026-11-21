// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("rend ses enfants", () => {
    render(
      <QueryProvider>
        <span>contenu enfant</span>
      </QueryProvider>,
    );
    expect(screen.getByText("contenu enfant")).toBeInTheDocument();
  });

  it("fournit un client React Query sans erreur", () => {
    const { container } = render(
      <QueryProvider>
        <div data-testid="inner">ok</div>
      </QueryProvider>,
    );
    expect(container).toBeTruthy();
    expect(screen.getByTestId("inner")).toHaveTextContent("ok");
  });
});