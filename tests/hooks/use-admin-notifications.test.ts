// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";

import useAdminNotifications from "@/hooks/use-admin-notifications";

const { mockChannel, mockPusher, pusherFactory, toast } = vi.hoisted(() => {
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
  const pusherFactory = vi.fn(function () {
    return mockPusher;
  });
  const toast = {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };
  return { mockChannel, mockPusher, pusherFactory, toast };
});

vi.mock("pusher-js", () => ({
  default: pusherFactory,
}));

vi.mock("sonner", () => ({
  toast,
}));

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "test-cluster";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne fait rien sans configuration Pusher", () => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(pusherFactory).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et s'abonne au canal admin", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(pusherFactory).toHaveBeenCalledWith("test-key", {
      cluster: "test-cluster",
      authEndpoint: "/api/pusher/auth",
      authTransport: "ajax",
    });
    expect(mockPusher.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();
    unmount();
  });

  it("affiche un toast success pour un événement utilisateur", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("user.registered", { message: "Bienvenue" });
    expect(toast.success).toHaveBeenCalledWith("Nouvel utilisateur inscrit", {
      description: "Bienvenue",
    });
    unmount();
  });

  it("affiche un toast warning pour une action importante", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("important.action", { title: "Alerte" });
    expect(toast.warning).toHaveBeenCalledWith("Action importante", {
      description: "Alerte",
    });
    unmount();
  });

  it("affiche un toast info pour les autres événements", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("something.else", { description: "info" });
    expect(toast.info).toHaveBeenCalledWith("info");
    unmount();
  });

  it("ignore les événements internes pusher:", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("pusher:connection_established", { message: "x" });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    unmount();
  });

  it("nettoie les ressources au démontage", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    unmount();
    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockChannel.unbind_global).toHaveBeenCalled();
    expect(mockPusher.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mockPusher.disconnect).toHaveBeenCalled();
  });
});
