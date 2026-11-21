// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

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

vi.mock("pusher-js", () => ({
  default: vi.fn(function () {
    return mockPusherInstance;
  }),
}));

import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { toast } from "sonner";
import Pusher from "pusher-js";

const MockedPusher = Pusher as unknown as ReturnType<typeof vi.fn>;

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

  it("ne crée pas de Pusher si la config est absente", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(MockedPusher).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et s'abonne au canal admin si config présente", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    expect(MockedPusher).toHaveBeenCalledWith("test-key", expect.objectContaining({
      cluster: "eu",
    }));
    expect(mockPusherInstance.subscribe).toHaveBeenCalledWith("private-admin");
    expect(mockChannel.bind_global).toHaveBeenCalled();

    unmount();
  });

  it("nettoie les ressources à la destruction", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    unmount();

    expect(mockChannel.unbind_all).toHaveBeenCalled();
    expect(mockChannel.unbind_global).toHaveBeenCalled();
    expect(mockPusherInstance.unsubscribe).toHaveBeenCalledWith("private-admin");
    expect(mockPusherInstance.disconnect).toHaveBeenCalled();
  });

  it("déclenche un toast pour un événement utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    renderHook(() => useAdminNotifications());

    // Récupère le callback bind_global
    const bindGlobalCall = mockChannel.bind_global.mock.calls[0][0];
    act(() => {
      bindGlobalCall("user.registered", { message: "Nouveau membre" });
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Nouvel utilisateur inscrit",
      expect.objectContaining({ description: "Nouveau membre" }),
    );
  });

  it("ignore les événements pusher:*", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "test-key";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    renderHook(() => useAdminNotifications());

    const bindGlobalCall = mockChannel.bind_global.mock.calls[0][0];
    act(() => {
      bindGlobalCall("pusher:subscription_succeeded", {});
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});