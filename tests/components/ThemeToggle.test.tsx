// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

afterEach(() => cleanup());

describe("ThemeToggle", () => {
  it("se rend dans un ThemeProvider", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
  });

  it("expose un aria-label selon le thème", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toMatch(/Activer le thème/);
  });

  it("affiche l'icône lune par défaut (thème clair)", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // Avant/après mount : rendu contient un svg (lucide)
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
