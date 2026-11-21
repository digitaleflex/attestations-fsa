// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
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
    const button = screen.getByRole("button");
    expect(button).toBeTruthy();
    expect(button.getAttribute("aria-label")).toBeTruthy();
  });

  it("affiche l'icône lune par défaut (thème clair)", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // Au premier rendu (non monté), l'icône Moon est rendue.
    expect(container.querySelector("svg")).toBeTruthy();
  });
});