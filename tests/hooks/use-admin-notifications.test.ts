// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { toast } from "sonner";
import useAdminNotifications from "@/hooks/use-admin-notifications";

const mocks = vi.hoisted(() => {
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
  const PusherCtor = vi.fn(function () {
    return pusher;
  });
  return { channel, pusher, PusherCtor };
});

vi.mock("pusher-js", () => ({ default: mocks.PusherCtor }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ne fait rien si la config Pusher est absente", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(mocks.PusherCtor).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher, s'abonne et se nettoie", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    expect(mocks.PusherCtor).toHaveBeenCalledWith("test-key", {
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
      authTransport: "ajax",
    });
    expect(mocks.pusher.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mocks.channel.bind_global).toHaveBeenCalled();

    unmount();
    expect(mocks.channel.unbind_all).toHaveBeenCalled();
    expect(mocks.channel.unbind_global).toHaveBeenCalled();
    expect(mocks.pusher.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mocks.pusher.disconnect).toHaveBeenCalled();
  });

  it("affiche un toast success pour un événement utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const bindCb = mocks.channel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      bindCb("user.registered", { message: "hi" });
    });

    expect(toast.success).toHaveBeenCalledWith("Nouvel utilisateur inscrit", {
      description: "hi",
    });

    unmount();
  });

  it("affiche un toast warning pour une action importante", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const bindCb = mocks.channel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      bindCb("important.action", { title: "t" });
    });

    expect(toast.warning).toHaveBeenCalledWith("Action importante", {
      description: "t",
    });

    unmount();
  });

  it("affiche un toast info pour les autres événements", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const bindCb = mocks.channel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      bindCb("other.event", { description: "d" });
    });

    expect(toast.info).toHaveBeenCalledWith("d");

    unmount();
  });

  it("ignore les événements internes pusher:*", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const bindCb = mocks.channel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    act(() => {
      bindCb("pusher:connection_established", { message: "x" });
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();

    unmount();
  });
});