// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("renders its children", () => {
    render(
      <QueryProvider>
        <span>child-content</span>
      </QueryProvider>,
    );
    expect(screen.getByText("child-content")).toBeTruthy();
  });

  it("provides a query client context", () => {
    const { container } = render(
      <QueryProvider>
        <div data-testid="wrapped">ok</div>
      </QueryProvider>,
    );
    expect(container.textContent).toContain("ok");
  });
});