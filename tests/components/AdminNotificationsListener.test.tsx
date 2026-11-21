// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

afterEach(cleanup);

describe("AdminNotificationsListener", () => {
  it("rend null (pas de sortie DOM)", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container.firstChild).toBeNull();
  });

  it("ne plante pas au montage", () => {
    expect(() => render(<AdminNotificationsListener />)).not.toThrow();
  });
});