// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const channel = {
  bind_global: vi.fn(),
  unbind_all: vi.fn(),
  unbind_global: vi.fn(),
};
const subscribeFn = vi.fn(() => channel);
const unsubscribeFn = vi.fn();
const disconnectFn = vi.fn();

vi.mock("pusher-js", () => {
  class PusherMock {
    constructor(_key: string, _opts: any) {}
    subscribe = subscribeFn;
    unsubscribe = unsubscribeFn;
    disconnect = disconnectFn;
  }
  return { default: PusherMock };
});

import { useAdminNotifications } from "@/hooks/use-admin-notifications";

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne fait rien sans configuration Pusher", () => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(subscribeFn).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et souscrit au canal admin", () => {
    renderHook(() => useAdminNotifications());
    expect(subscribeFn).toHaveBeenCalledWith("private-admin");
    expect(channel.bind_global).toHaveBeenCalled();
  });

  it("nettoie à l'unmount", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    act(() => {
      unmount();
    });
    expect(channel.unbind_all).toHaveBeenCalled();
    expect(channel.unbind_global).toHaveBeenCalled();
    expect(unsubscribeFn).toHaveBeenCalledWith("private-admin");
    expect(disconnectFn).toHaveBeenCalled();
  });
});
