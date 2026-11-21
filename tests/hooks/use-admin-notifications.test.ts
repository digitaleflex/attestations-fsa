// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { PusherMock, mockPusherInstance, mockChannel, toastMock } = vi.hoisted(() => {
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
  const PusherMock = vi.fn(function () {
    return mockPusherInstance;
  });
  const toastMock = {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };
  return { PusherMock, mockPusherInstance, mockChannel, toastMock };
});

vi.mock("pusher-js", () => ({
  default: PusherMock,
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

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
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(PusherMock).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et s'abonne au canal admin", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(PusherMock).toHaveBeenCalledWith("test-key", {
      cluster: "eu",
      authEndpoint: "/api/pusher/auth",
      authTransport: "ajax",
    });
    expect(mockPusherInstance.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();
    unmount();
  });

  it("nettoie lors du démontage", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    unmount();
    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockChannel.unbind_global).toHaveBeenCalled();
    expect(mockPusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mockPusherInstance.disconnect).toHaveBeenCalled();
  });

  it("affiche un toast de succès pour un événement utilisateur", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("user:registered", { message: "Nouveau" });
    expect(toastMock.success).toHaveBeenCalledWith(
      "Nouvel utilisateur inscrit",
      { description: "Nouveau" },
    );
    unmount();
  });

  it("affiche un toast d'avertissement pour une action importante", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("important:action", { title: "Alerte" });
    expect(toastMock.warning).toHaveBeenCalledWith("Action importante", {
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
    handler("something", { description: "desc" });
    expect(toastMock.info).toHaveBeenCalledWith("desc");
    unmount();
  });

  it("ignore les événements internes pusher:*", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0] as (
      eventName: string,
      data: any,
    ) => void;
    handler("pusher:subscription_succeeded", { message: "x" });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(toastMock.info).not.toHaveBeenCalled();
    unmount();
  });
});
