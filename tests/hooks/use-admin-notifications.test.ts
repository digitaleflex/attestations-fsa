// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { MockPusher, mockPusherInstance, mockChannel, toastMocks } = vi.hoisted(() => {
  const mockChannel = {
    bind_global: vi.fn(),
    unbind_all: vi.fn(),
    unbind_global: vi.fn(),
  };
  const mockPusherInstance = {
    subscribe: vi.fn(() => mockChannel),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  };
  const MockPusher = vi.fn(function () {
    return mockPusherInstance;
  });
  const toastMocks = {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };
  return { MockPusher, mockPusherInstance, mockChannel, toastMocks };
});

vi.mock("pusher-js", () => ({
  default: MockPusher,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

import { useAdminNotifications } from "@/hooks/use-admin-notifications";

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPusherInstance.subscribe.mockImplementation(() => mockChannel);
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne fait rien sans configuration Pusher", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(MockPusher).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et s'abonne au canal admin si configuré", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    expect(MockPusher).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({
        cluster: "eu",
        authEndpoint: "/api/pusher/auth",
      }),
    );
    expect(mockPusherInstance.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();

    unmount();
    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockChannel.unbind_global).toHaveBeenCalled();
    expect(mockPusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mockPusherInstance.disconnect).toHaveBeenCalled();
  });

  it("affiche un toast success pour un nouvel utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    const callback = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    callback("user.registered", { message: "Bienvenue" });

    expect(toastMocks.success).toHaveBeenCalledWith("Nouvel utilisateur inscrit", {
      description: "Bienvenue",
    });

    unmount();
  });

  it("ignore les événements internes pusher:*", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    const callback = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    callback("pusher:subscription_succeeded", { message: "ignored" });

    expect(toastMocks.success).not.toHaveBeenCalled();
    expect(toastMocks.warning).not.toHaveBeenCalled();
    expect(toastMocks.info).not.toHaveBeenCalled();

    unmount();
  });

  it("affiche un toast warning pour une action importante", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    const callback = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    callback("important.action", { title: "Alerte" });

    expect(toastMocks.warning).toHaveBeenCalledWith("Action importante", {
      description: "Alerte",
    });

    unmount();
  });

  it("affiche un toast info par défaut", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    const callback = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    callback("something.else", { description: "info msg" });

    expect(toastMocks.info).toHaveBeenCalledWith("info msg");

    unmount();
  });
});