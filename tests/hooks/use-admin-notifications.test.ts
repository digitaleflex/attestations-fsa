// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";

vi.mock("pusher-js", () => {
  const pushers: any[] = [];
  const channels: any[] = [];
  class MockChannel {
    bind_global = vi.fn();
    unbind_all = vi.fn();
    unbind_global = vi.fn();
    constructor() {
      channels.push(this);
    }
  }
  class MockPusher {
    subscribe = vi.fn(() => new MockChannel());
    unsubscribe = vi.fn();
    disconnect = vi.fn();
    constructor(...args: any[]) {
      pushers.push(this);
      (this as any).__args = args;
    }
  }
  (globalThis as any).__pusherInstances = pushers;
  (globalThis as any).__channelInstances = channels;
  return { default: MockPusher };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

function pushers() {
  return (globalThis as any).__pusherInstances as any[];
}
function channels() {
  return (globalThis as any).__channelInstances as any[];
}

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushers().length = 0;
    channels().length = 0;
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne initialise pas Pusher sans configuration", () => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(pushers().length).toBe(0);
    unmount();
  });

  it("initialise Pusher et souscrit au canal admin", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    expect(pushers().length).toBe(1);
    const pusherInstance = pushers()[0];
    expect(pusherInstance.__args[0]).toBe("test-key");
    expect(pusherInstance.__args[1]).toEqual(expect.objectContaining({
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
      authTransport: "ajax",
    }));
    expect(pusherInstance.subscribe).toHaveBeenCalledWith("private-admin");

    const channelInstance = channels()[0];
    expect(channelInstance.bind_global).toHaveBeenCalled();

    unmount();
  });

  it("affiche un toast pour un événement utilisateur", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    const channelInstance = channels()[0];
    const handler = channelInstance.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      handler("user:registered", { message: "Nouveau compte" });
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Nouvel utilisateur inscrit",
      expect.objectContaining({ description: "Nouveau compte" }),
    );

    unmount();
  });

  it("affiche un toast info pour un événement générique", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    const channelInstance = channels()[0];
    const handler = channelInstance.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      handler("activity", { title: "Quelque chose" });
    });

    expect(toast.info).toHaveBeenCalledWith("Quelque chose");

    unmount();
  });

  it("affiche un toast warning pour une action importante", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    const channelInstance = channels()[0];
    const handler = channelInstance.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      handler("important:action", { message: "Attention" });
    });

    expect(toast.warning).toHaveBeenCalledWith(
      "Action importante",
      expect.objectContaining({ description: "Attention" }),
    );

    unmount();
  });

  it("ignore les événements internes pusher:", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    const channelInstance = channels()[0];
    const handler = channelInstance.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      handler("pusher:connection_established", {});
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();

    unmount();
  });

  it("nettoie les ressources au démontage", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    const pusherInstance = pushers()[0];
    const channelInstance = channels()[0];

    unmount();

    expect(channelInstance.unbind_all).toHaveBeenCalled();
    expect(channelInstance.unbind_global).toHaveBeenCalled();
    expect(pusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(pusherInstance.disconnect).toHaveBeenCalled();
  });
});
