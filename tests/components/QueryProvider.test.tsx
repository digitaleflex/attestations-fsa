// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { useQueryClient } from "@tanstack/react-query";

describe("QueryProvider", () => {
  it("renders its children", () => {
    render(
      <QueryProvider>
        <span>hello-child</span>
      </QueryProvider>,
    );
    expect(screen.getByText("hello-child")).not.toBeNull();
  });

  it("provides a QueryClient to descendants", () => {
    function Child() {
      const qc = useQueryClient();
      return <span>{qc ? "client-ok" : "no-client"}</span>;
    }
    render(
      <QueryProvider>
        <Child />
      </QueryProvider>,
    );
    expect(screen.getByText("client-ok")).not.toBeNull();
  });

  it("renders multiple children", () => {
    render(
      <QueryProvider>
        <span>a</span>
        <span>b</span>
      </QueryProvider>,
    );
    expect(screen.getByText("a")).not.toBeNull();
    expect(screen.getByText("b")).not.toBeNull();
  });
});
