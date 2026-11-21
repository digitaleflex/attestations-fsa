// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("pusher-js", () => {
  const channel = {
    bind_global: vi.fn(),
    unbind_all: vi.fn(),
    unbind_global: vi.fn(),
  };
  const pusher = {
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  };
  (globalThis as any).__pusherChannel = channel;
  (globalThis as any).__pusherInstance = pusher;
  const Pusher = vi.fn(function () {
    return pusher;
  });
  return { default: Pusher };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import Pusher from "pusher-js";

const getChannel = () => (globalThis as any).__pusherChannel;
const getPusher = () => (globalThis as any).__pusherInstance;

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_PUSHER_KEY;
  delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
});

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne fait rien si les variables Pusher sont absentes", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(Pusher).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et souscrit au canal admin si configuré", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    expect(Pusher).toHaveBeenCalledWith("test-key", expect.objectContaining({
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
      authTransport: "ajax",
    }));
    expect(getPusher().subscribe).toHaveBeenCalledWith("private-admin");
    expect(getChannel().bind_global).toHaveBeenCalled();

    unmount();
    expect(getChannel().unbind_all).toHaveBeenCalled();
    expect(getChannel().unbind_global).toHaveBeenCalled();
    expect(getPusher().unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(getPusher().disconnect).toHaveBeenCalled();
  });

  it("appelle handleEvent via bind_global pour un événement utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    const bindGlobal = getChannel().bind_global;
    expect(bindGlobal).toHaveBeenCalled();
    const handler = bindGlobal.mock.calls[0][0];
    handler("user:registered", { message: "nouveau" });

    unmount();
  });
});