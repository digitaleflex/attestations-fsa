// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

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
    expect(btn.getAttribute("aria-label")).toMatch(/Activer le thème/);
  });

  it("affiche l'icône lune par défaut (thème clair)", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // Moon icon rendered as svg; no crash
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("bascule le thème au clic", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button");
    const before = btn.getAttribute("aria-label");
    fireEvent.click(btn);
    // After toggle, aria-label should change
    expect(btn.getAttribute("aria-label")).not.toBe(before);
  });
});
