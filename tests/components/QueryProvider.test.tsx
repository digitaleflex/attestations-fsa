// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { useQueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/components/providers/QueryProvider";

function Consumer() {
  const qc = useQueryClient();
  return <span data-testid="has-client">{qc ? "ok" : "no"}</span>;
}

describe("QueryProvider", () => {
  it("fournit un QueryClient et rend ses enfants", () => {
    render(
      <QueryProvider>
        <div>contenu enfant</div>
        <Consumer />
      </QueryProvider>,
    );
    expect(screen.getByText("contenu enfant")).toBeInTheDocument();
    expect(screen.getByTestId("has-client")).toHaveTextContent("ok");
  });
});
