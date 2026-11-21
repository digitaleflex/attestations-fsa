// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryProvider } from "@/components/providers/QueryProvider";

afterEach(() => cleanup());

describe("QueryProvider", () => {
  it("rend ses enfants", () => {
    render(
      <QueryProvider>
        <span>contenu enfant</span>
      </QueryProvider>,
    );
    expect(screen.getByText("contenu enfant")).toBeInTheDocument();
  });

  it("fournit un client de requête (pas de crash)", () => {
    const { container } = render(
      <QueryProvider>
        <div data-testid="x">ok</div>
      </QueryProvider>,
    );
    expect(container.querySelector('[data-testid="x"]')).not.toBeNull();
  });
});
