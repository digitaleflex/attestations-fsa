// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { ThemeProvider } from "@/lib/theme-context";

describe("ThemeToggle", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("rend un bouton avec un libellé accessible", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeTruthy();
    expect(button.getAttribute("aria-label")).toBe("Activer le thème sombre");
  });

  it("bascule le thème au clic", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button.getAttribute("aria-label")).toBe("Activer le thème clair");
  });
});
