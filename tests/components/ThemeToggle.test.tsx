// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("rend un bouton accessible avec le libellé du thème clair par défaut", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button", {
      name: /activer le thème sombre/i,
    });
    expect(button).toBeInTheDocument();
  });

  it("bascule le thème au clic et met à jour le libellé", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button", {
      name: /activer le thème sombre/i,
    });
    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: /activer le thème clair/i }),
    ).toBeInTheDocument();
  });
});