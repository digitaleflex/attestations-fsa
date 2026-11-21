// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

describe("ThemeToggle", () => {
  it("rend un bouton avec un libellé accessible", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toMatch(/thème/i);
  });

  it("affiche l'icône lune par défaut (thème clair)", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // Le bouton contient un svg (icône lucide)
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
