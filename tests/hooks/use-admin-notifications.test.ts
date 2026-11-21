// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";

const { mockPusher, mockChannel, PusherMock } = vi.hoisted(() => {
  const mockChannel = {
    bind_global: vi.fn(),
    unbind_all: vi.fn(),
    unbind_global: vi.fn(),
  };
  const mockPusher = {
    subscribe: vi.fn(() => mockChannel),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  };
  const PusherMock = vi.fn(function () { return mockPusher; });
  return { mockPusher, mockChannel, PusherMock };
});

vi.mock("pusher-js", () => ({ default: PusherMock }));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAdminNotifications } from "@/hooks/use-admin-notifications";

describe("useAdminNotifications", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // restore implementations after clearAllMocks
    mockPusher.subscribe.mockImplementation(() => mockChannel);
  });

  it("initialise Pusher et s'abonne au canal admin", async () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    await waitFor(() => {
      expect(PusherMock).toHaveBeenCalled();
    });

    expect(PusherMock).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ cluster: "eu", authEndpoint: "/api/pusher/auth" }),
    );
    expect(mockPusher.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();

    unmount();

    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockPusher.disconnect).toHaveBeenCalled();
  });

  it("ne fait rien sans configuration Pusher", () => {
    const prevKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const prevCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    const { unmount } = renderHook(() => useAdminNotifications());
    expect(PusherMock).not.toHaveBeenCalled();
    unmount();

    process.env.NEXT_PUBLIC_PUSHER_KEY = prevKey;
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = prevCluster;
  });
});
