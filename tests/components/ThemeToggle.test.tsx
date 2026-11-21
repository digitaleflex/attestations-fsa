// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { ThemeProvider } from "@/lib/theme-context";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("rend un bouton avec libellé accessible", () => {
    render(
      React.createElement(ThemeProvider, null, React.createElement(ThemeToggle)),
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toContain("thème");
  });

  it("bascule le thème au clic", () => {
    render(
      React.createElement(ThemeProvider, null, React.createElement(ThemeToggle)),
    );
    const btn = screen.getByRole("button");
    // mounted effect
    act(() => {});
    const initialLabel = btn.getAttribute("aria-label");
    act(() => {
      btn.click();
    });
    expect(btn.getAttribute("aria-label")).not.toBe(initialLabel);
  });
});