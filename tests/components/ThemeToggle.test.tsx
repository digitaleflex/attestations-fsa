// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("rend un bouton accessible", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("affiche le libellé pour activer le thème sombre par défaut", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("button", { name: /activer le thème sombre/i }),
    ).toBeInTheDocument();
  });

  it("bascule le libellé après un clic", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: /activer le thème clair/i }),
    ).toBeInTheDocument();
  });
});