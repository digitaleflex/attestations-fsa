// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { useQueryClient } from "@tanstack/react-query";

function Consumer() {
  const qc = useQueryClient();
  return <span data-testid="qc">{qc ? "ok" : "ko"}</span>;
}

describe("QueryProvider", () => {
  it("rend ses enfants et fournit un QueryClient", () => {
    render(
      <QueryProvider>
        <div>child-content</div>
        <Consumer />
      </QueryProvider>,
    );
    expect(screen.getByText("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("qc")).toHaveTextContent("ok");
  });
});
