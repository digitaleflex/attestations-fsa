// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

afterEach(cleanup);

describe("ThemeToggle", () => {
  it("rend un bouton avec un libellé accessible", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toBeTruthy();
  });

  it("affiche l'icône lune par défaut (thème clair)", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // par défaut theme=light => Moon rendered (aria-label sombre)
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Activer le thème sombre",
    );
  });

  it("bascule le thème au clic", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    // après toggle, theme=dark => aria-label clair
    expect(btn.getAttribute("aria-label")).toBe("Activer le thème clair");
  });
});