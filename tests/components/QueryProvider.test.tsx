// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("rend ses enfants dans le provider", () => {
    render(
      <QueryProvider>
        <span>contenu enfant</span>
      </QueryProvider>,
    );
    expect(screen.getByText("contenu enfant")).toBeInTheDocument();
  });
});