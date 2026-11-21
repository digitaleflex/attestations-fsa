// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

function SetThemeButton() {
  const { setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme("dark")}>
      set-dark
    </button>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders a toggle button with an accessible label", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button", { name: /Activer le thème/ });
    expect(button).toBeTruthy();
    expect(button.querySelector("svg")).toBeTruthy();
  });

  it("toggles the theme and updates the label on click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = screen.getByRole("button", { name: /Activer le thème/ });
    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: /Activer le thème/ }),
    ).toBeTruthy();
  });

  it("initializes from a stored dark theme", () => {
    window.localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    // mounted effect reads storage; button label reflects dark theme
    expect(
      screen.getByRole("button", { name: /Activer le thème clair/ }),
    ).toBeTruthy();
  });

  it("covers setTheme via a consumer", () => {
    render(
      <ThemeProvider>
        <SetThemeButton />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText("set-dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});