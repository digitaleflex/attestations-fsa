// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";

const { mockPusherInstance, mockChannel, toastMock } = vi.hoisted(() => {
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
  const toastMock = {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };
  return { mockPusherInstance, mockChannel, toastMock };
});

vi.mock("pusher-js", () => {
  const MockPusher = vi.fn(function () {
    return mockPusherInstance;
  });
  return { default: MockPusher };
});

vi.mock("sonner", () => ({
  toast: toastMock,
}));

import Pusher from "pusher-js";
import { useAdminNotifications } from "@/hooks/use-admin-notifications";

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne crée pas de Pusher sans config", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(Pusher).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et souscrit au canal admin avec config", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(Pusher).toHaveBeenCalledWith("test-key", expect.objectContaining({
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
    }));
    expect(mockPusherInstance.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();
    unmount();
  });

  it("nettoie les abonnements au démontage", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    const { unmount } = renderHook(() => useAdminNotifications());
    unmount();
    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockChannel.unbind_global).toHaveBeenCalled();
    expect(mockPusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mockPusherInstance.disconnect).toHaveBeenCalled();
  });

  it("affiche un toast pour un événement utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let capturedCallback: ((eventName: string, data: any) => void) | null = null;
    mockChannel.bind_global.mockImplementation((cb: any) => {
      capturedCallback = cb;
    });
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(capturedCallback).not.toBeNull();
    act(() => {
      capturedCallback!("user:registered", { message: "hi" });
    });
    expect(toastMock.success).toHaveBeenCalledWith("Nouvel utilisateur inscrit", expect.objectContaining({ description: "hi" }));
    unmount();
  });

  it("ignore les événements pusher:*", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";
    let capturedCallback: ((eventName: string, data: any) => void) | null = null;
    mockChannel.bind_global.mockImplementation((cb: any) => {
      capturedCallback = cb;
    });
    const { unmount } = renderHook(() => useAdminNotifications());
    act(() => {
      capturedCallback!("pusher:subscription_succeeded", { message: "x" });
    });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(toastMock.info).not.toHaveBeenCalled();
    unmount();
  });
});