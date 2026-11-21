// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

describe("ThemeToggle", () => {
  it("se rend dans un ThemeProvider", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.getAttribute("type")).toBe("button");
  });

  it("affiche le libellé accessible du thème clair par défaut", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Activer le thème sombre");
  });

  it("bascule le libellé après un clic", () => {
    const { container } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.getAttribute("aria-label")).toBe("Activer le thème clair");
  });
});
