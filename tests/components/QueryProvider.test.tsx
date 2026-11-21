// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryProvider } from "@/components/providers/QueryProvider";

describe("QueryProvider", () => {
  it("rend ses enfants", () => {
    render(
      React.createElement(QueryProvider, null, React.createElement("span", null, "child-content")),
    );
    expect(screen.getByText("child-content")).toBeTruthy();
  });
});