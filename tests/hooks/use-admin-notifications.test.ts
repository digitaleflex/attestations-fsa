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

vi.mock("pusher-js", () => {
  const Pusher = vi.fn(function () {
    return mockPusherInstance;
  });
  return { default: Pusher };
});

import { useAdminNotifications } from "@/hooks/use-admin-notifications";
import { toast } from "sonner";
import Pusher from "pusher-js";

describe("useAdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPusherInstance.subscribe.mockReturnValue(mockChannel);
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PUSHER_KEY;
    delete process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  });

  it("ne crée pas de Pusher si la config est absente", () => {
    const { unmount } = renderHook(() => useAdminNotifications());
    expect(Pusher).not.toHaveBeenCalled();
    unmount();
  });

  it("initialise Pusher et s'abonne au canal admin si config présente", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "pk_test";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());

    expect(Pusher).toHaveBeenCalledWith(
      "pk_test",
      expect.objectContaining({
        cluster: "eu",
        authEndpoint: "/api/pusher/auth",
        authTransport: "ajax",
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

  it("ignore les événements internes pusher:*", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "pk_test";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0];
    act(() => {
      handler("pusher:connection_established", {});
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    unmount();
  });

  it("affiche un toast success pour un nouvel utilisateur", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "pk_test";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0];
    act(() => {
      handler("user:registered", { message: "Bienvenue" });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Nouvel utilisateur inscrit",
      expect.objectContaining({ description: "Bienvenue" }),
    );
    unmount();
  });

  it("affiche un toast warning pour une action importante", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "pk_test";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0];
    act(() => {
      handler("important:action", { title: "Alerte" });
    });
    expect(toast.warning).toHaveBeenCalledWith(
      "Action importante",
      expect.objectContaining({ description: "Alerte" }),
    );
    unmount();
  });

  it("affiche un toast info par défaut", () => {
    process.env.NEXT_PUBLIC_PUSHER_KEY = "pk_test";
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "eu";

    const { unmount } = renderHook(() => useAdminNotifications());
    const handler = mockChannel.bind_global.mock.calls[0][0];
    act(() => {
      handler("something:happened", { description: "desc" });
    });
    expect(toast.info).toHaveBeenCalledWith("desc");
    unmount();
  });
});
