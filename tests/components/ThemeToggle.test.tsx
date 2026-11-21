// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

describe("ThemeToggle", () => {
  it("se rend dans un ThemeProvider", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
    expect(button.getAttribute("aria-label")).toMatch(/thème/i);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("affiche l'icône Moon par défaut (thème clair)", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // aria-label indique le thème à activer (sombre) => thème courant clair
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Activer le thème sombre",
    );
  });
});
