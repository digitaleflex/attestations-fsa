// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rend null (pas d'UI)", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container).toBeEmptyDOMElement();
  });
});