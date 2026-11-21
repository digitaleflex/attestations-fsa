// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("rend ses enfants", () => {
    render(
      <QueryProvider>
        <span data-testid="child">contenu</span>
      </QueryProvider>,
    );
    expect(screen.getByTestId("child").textContent).toBe("contenu");
  });
});
