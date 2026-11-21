// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";

const { mockChannel, mockPusher, PusherMock } = vi.hoisted(() => {
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
  const PusherMock = vi.fn(function () {
    return mockPusher;
  });
  return { mockChannel, mockPusher, PusherMock };
});

process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("pusher-js", () => ({
  default: PusherMock,
}));

import { toast } from "sonner";
import Pusher from "pusher-js";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
};

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initialise Pusher et souscrit au canal admin", () => {
    const { unmount } = renderHook(() => useAdminNotifications());

    expect(Pusher).toHaveBeenCalledWith("test-key", expect.objectContaining({
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
    }));
    expect(mockPusher.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();

    unmount();
    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockChannel.unbind_global).toHaveBeenCalled();
    expect(mockPusher.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mockPusher.disconnect).toHaveBeenCalled();
  });

  it("déclenche toast.success pour un événement utilisateur", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    handler("new-user-registered", { message: "Bonjour" });

    expect(mockToast.success).toHaveBeenCalledWith(
      "Nouvel utilisateur inscrit",
      expect.objectContaining({ description: "Bonjour" }),
    );

    unmount();
  });

  it("déclenche toast.warning pour une action importante", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    handler("important-action", { title: "Attention" });

    expect(mockToast.warning).toHaveBeenCalledWith(
      "Action importante",
      expect.objectContaining({ description: "Attention" }),
    );

    unmount();
  });

  it("déclenche toast.info pour un autre événement", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    handler("something-else", { description: "Info msg" });

    expect(mockToast.info).toHaveBeenCalledWith("Info msg");

    unmount();
  });

  it("ignore les événements internes pusher:*", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;

    handler("pusher:connection_established", { message: "x" });

    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.warning).not.toHaveBeenCalled();
    expect(mockToast.info).not.toHaveBeenCalled();

    unmount();
  });

  it("ne fait rien si la config Pusher est absente", () => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    const subscribeCallsBefore = mockPusher.subscribe.mock.calls.length;
    const { unmount } = renderHook(() => useAdminNotifications());

    expect(mockPusher.subscribe.mock.calls.length).toBe(subscribeCallsBefore);

    unmount();
  });
});
