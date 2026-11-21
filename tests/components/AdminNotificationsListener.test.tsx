// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { AdminNotificationsListener } from "@/components/admin/AdminNotificationsListener";

describe("AdminNotificationsListener", () => {
  const originalKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const originalCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = originalKey;
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = originalCluster;
  });

  it("rend null (pas de UI)", () => {
    const { container } = render(<AdminNotificationsListener />);
    expect(container).toBeEmptyDOMElement();
  });
});
